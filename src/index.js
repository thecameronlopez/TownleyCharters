export default {
    async fetch(request, env) {
        const url = new URL(request.url);

        if (url.pathname === "/api/availability") {
            return Response.json({
                success: true,
                message: "Townley availability API is working."
            });
        }


        return env.ASSETS.fetch(request);
    }
}