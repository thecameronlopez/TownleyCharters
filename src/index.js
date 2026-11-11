const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_FREEBUSY_URL =
    "https://www.googleapis.com/calendar/v3/freeBusy";

const GOOGLE_SCOPE =
    "https://www.googleapis.com/auth/calendar.freebusy";

export default {
    async fetch(request, env) {
        const url = new URL(request.url);

        if (url.pathname === "/api/availability") {
            try {
                return await getAvailability(url, env);
            } catch (error) {
                console.error("Availability error:", error);

                return Response.json(
                    {
                        success: false,
                        error: "Unable to load availability."
                    },
                    {
                        status: 500
                    }
                );
            }
        }

        return env.ASSETS.fetch(request);
    }
};


async function getAvailability(url, env) {
    const now = new Date();

    const year =
        Number(url.searchParams.get("year")) ||
        now.getFullYear();

    const month =
        Number(url.searchParams.get("month")) ||
        now.getMonth() + 1;

    const start = new Date(
        Date.UTC(year, month - 1, 1)
    );

    const end = new Date(
        Date.UTC(year, month, 1)
    );

    const accessToken = await getGoogleAccessToken(env);

    const response = await fetch(GOOGLE_FREEBUSY_URL, {
        method: "POST",

        headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json"
        },

        body: JSON.stringify({
            timeMin: start.toISOString(),
            timeMax: end.toISOString(),

            timeZone: "America/Chicago",

            items: [
                {
                    id: env.GOOGLE_CALENDAR_ID
                }
            ]
        })
    });

    if (!response.ok) {
        const errorText = await response.text();

        console.error(
            "Google Calendar error:",
            response.status,
            errorText
        );

        throw new Error(
            `Google Calendar returned ${response.status}`
        );
    }

    const data = await response.json();

    const calendar =
        data.calendars?.[env.GOOGLE_CALENDAR_ID];

    if (!calendar) {
        throw new Error(
            "Calendar not found in Google response."
        );
    }

    /*
        For now we're deliberately returning Google's
        busy blocks.

        Later we'll transform these into individual
        Townley available/unavailable dates.
    */

    return Response.json({
        success: true,
        year,
        month,
        busy: calendar.busy ?? []
    });
}


async function getGoogleAccessToken(env) {
    const now = Math.floor(Date.now() / 1000);

    const header = {
        alg: "RS256",
        typ: "JWT"
    };

    const payload = {
        iss: env.GOOGLE_CLIENT_EMAIL,

        scope: GOOGLE_SCOPE,

        aud: GOOGLE_TOKEN_URL,

        iat: now,

        exp: now + 3600
    };

    const encodedHeader =
        base64UrlEncode(
            JSON.stringify(header)
        );

    const encodedPayload =
        base64UrlEncode(
            JSON.stringify(payload)
        );

    const unsignedToken =
        `${encodedHeader}.${encodedPayload}`;

    const privateKey =
        await importPrivateKey(
            env.GOOGLE_PRIVATE_KEY
        );

    const signature =
        await crypto.subtle.sign(
            {
                name: "RSASSA-PKCS1-v1_5"
            },
            privateKey,
            new TextEncoder().encode(unsignedToken)
        );

    const encodedSignature =
        base64UrlEncodeBytes(
            new Uint8Array(signature)
        );

    const jwt =
        `${unsignedToken}.${encodedSignature}`;

    const response = await fetch(
        GOOGLE_TOKEN_URL,
        {
            method: "POST",

            headers: {
                "Content-Type":
                    "application/x-www-form-urlencoded"
            },

            body: new URLSearchParams({
                grant_type:
                    "urn:ietf:params:oauth:grant-type:jwt-bearer",

                assertion: jwt
            })
        }
    );

    if (!response.ok) {
        const errorText = await response.text();

        console.error(
            "Google OAuth error:",
            response.status,
            errorText
        );

        throw new Error(
            `Google OAuth returned ${response.status}`
        );
    }

    const data = await response.json();

    if (!data.access_token) {
        throw new Error(
            "Google did not return an access token."
        );
    }

    return data.access_token;
}


async function importPrivateKey(pem) {
    /*
        Cloudflare/environment-variable storage can leave
        literal \n sequences depending on how the secret
        was entered.

        Normalize those before importing the PEM.
    */

    const normalizedPem =
        pem.replace(/\\n/g, "\n");

    const pemContents =
        normalizedPem
            .replace(
                "-----BEGIN PRIVATE KEY-----",
                ""
            )
            .replace(
                "-----END PRIVATE KEY-----",
                ""
            )
            .replace(/\s/g, "");

    const binaryDer =
        Uint8Array.from(
            atob(pemContents),
            char => char.charCodeAt(0)
        );

    return crypto.subtle.importKey(
        "pkcs8",
        binaryDer.buffer,
        {
            name: "RSASSA-PKCS1-v1_5",
            hash: "SHA-256"
        },
        false,
        ["sign"]
    );
}


function base64UrlEncode(value) {
    const bytes =
        new TextEncoder().encode(value);

    return base64UrlEncodeBytes(bytes);
}


function base64UrlEncodeBytes(bytes) {
    let binary = "";

    for (const byte of bytes) {
        binary +=
            String.fromCharCode(byte);
    }

    return btoa(binary)
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");
}