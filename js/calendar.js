const calendarMonth = document.getElementById("calendar-month");
const calendarDays = document.getElementById("calendar-days");

const previousMonthButton = document.getElementById("previous-month");
const nextMonthButton = document.getElementById("next-month");

const dateSelection = document.getElementById("date-selection");
const selectedDateText = document.getElementById("selected-date");
const selectedDateMessage = document.getElementById("selected-date-message");
const bookingText = document.getElementById("booking-text");

const PHONE_NUMBER = "+13373683273";

const today = new Date();
today.setHours(0, 0, 0, 0);

const MIN_YEAR = today.getFullYear();
const MIN_MONTH = today.getMonth();

const MAX_MONTHS_AHEAD = 12;

const maxDate = new Date(
    MIN_YEAR,
    MIN_MONTH + MAX_MONTHS_AHEAD,
    1
);

let displayedYear = MIN_YEAR;
let displayedMonth = MIN_MONTH; // 0-based: January = 0

let selectedButton = null;


/*
    Initial load
*/

loadCalendar();


/*
    Navigation
*/

previousMonthButton.addEventListener("click", () => {
    if (isAtMinimumMonth){
        return;
    }
    
    
    displayedMonth--;

    if (displayedMonth < 0) {
        displayedMonth = 11;
        displayedYear--;
    }

    loadCalendar();
});


nextMonthButton.addEventListener("click", () => {
    if (isAtMaximumMonth()) {
        return;
    }


    displayedMonth++;

    if (displayedMonth > 11) {
        displayedMonth = 0;
        displayedYear++;
    }

    loadCalendar();
});


/*
    Load availability from Townley API
*/

async function loadCalendar() {
    clearSelection();
    updateNavigationButtons();

    calendarDays.innerHTML = "";

    calendarMonth.textContent = new Intl.DateTimeFormat(
        "en-US",
        {
            month: "long",
            year: "numeric"
        }
    ).format(
        new Date(displayedYear, displayedMonth, 1)
    );

    try {
        const response = await fetch(
            `/api/availability?year=${displayedYear}&month=${displayedMonth + 1}`
        );

        if (!response.ok) {
            throw new Error(
                `Availability request failed with ${response.status}`
            );
        }

        const data = await response.json();

        if (!data.success) {
            throw new Error(
                data.error || "Unable to load availability."
            );
        }

        const unavailableDates =
            getUnavailableDates(data.busy);

        renderCalendar(unavailableDates);
    }
    catch (error) {
        console.error("Calendar error:", error);

        calendarDays.innerHTML = `
            <p class="calendar-error">
                Availability could not be loaded.
                Please call or text us for current availability.
            </p>
        `;
    }
}


/*
    Google gives us time ranges.

    For v1 Townley assumes:
    ANY busy event on a date makes the whole day unavailable.
*/

/*
    Townley Charter & Co. operates a maximum of one
    charter per calendar day.

    Therefore, any busy interval returned by the admin
    Google Calendar makes the entire date unavailable.
*/
function getUnavailableDates(busyPeriods) {
    const unavailableDates = new Set();

    for (const busy of busyPeriods) {
        const start = new Date(busy.start);
        const end = new Date(busy.end);

        /*
            Walk through every calendar date touched by the
            busy period.

            Subtract one millisecond from the end because an
            all-day event normally ends at midnight of the
            following day.
        */

        const lastMoment = new Date(end.getTime() - 1);

        const current = new Date(
            start.getFullYear(),
            start.getMonth(),
            start.getDate()
        );

        const lastDate = new Date(
            lastMoment.getFullYear(),
            lastMoment.getMonth(),
            lastMoment.getDate()
        );

        while (current <= lastDate) {
            unavailableDates.add(
                formatDateKey(current)
            );

            current.setDate(current.getDate() + 1);
        }
    }

    return unavailableDates;
}


/*
    Render month
*/

function renderCalendar(unavailableDates) {
    calendarDays.innerHTML = "";

    const firstDay =
        new Date(
            displayedYear,
            displayedMonth,
            1
        ).getDay();

    const daysInMonth =
        new Date(
            displayedYear,
            displayedMonth + 1,
            0
        ).getDate();


    /*
        Empty cells before the first day of the month
    */

    for (let i = 0; i < firstDay; i++) {
        const emptyCell = document.createElement("div");

        emptyCell.classList.add(
            "calendar-day",
            "empty"
        );

        calendarDays.appendChild(emptyCell);
    }


    /*
        Actual days
    */

    for (
        let day = 1;
        day <= daysInMonth;
        day++
    ) {
        const date =
            new Date(
                displayedYear,
                displayedMonth,
                day
            );

        const dateKey =
            formatDateKey(date);

        const isUnavailable =
            unavailableDates.has(dateKey);

        const isPast =
            date < today;

        const button =
            document.createElement("button");

        button.type = "button";

        button.classList.add("calendar-day");

        button.textContent = day;

        button.dataset.date = dateKey;


        /*
            Past dates
        */

        if (isPast) {
            button.classList.add(
                "unavailable",
                "past"
            );

            button.disabled = true;

            button.setAttribute(
                "aria-label",
                `${formatLongDate(date)} unavailable`
            );
        }

        /*
            Busy dates
        */

        else if (isUnavailable) {
            button.classList.add("unavailable");

            button.disabled = true;

            button.setAttribute(
                "aria-label",
                `${formatLongDate(date)} unavailable`
            );
        }

        /*
            Available dates
        */

        else {
            button.classList.add("available");

            button.setAttribute(
                "aria-label",
                `${formatLongDate(date)} available`
            );

            button.addEventListener(
                "click",
                () => selectDate(date, button)
            );
        }

        calendarDays.appendChild(button);
    }
}


/*
    Select available date
*/

function selectDate(date, button) {
    if (selectedButton) {
        selectedButton.classList.remove(
            "selected"
        );
    }

    selectedButton = button;

    selectedButton.classList.add(
        "selected"
    );

    const formattedDate =
        formatLongDate(date);

    selectedDateText.textContent =
        formattedDate;

    selectedDateMessage.textContent =
        "This date is currently available. Call or text Townley Charter & Co. to confirm your trip.";

    const message =
        `Hi! I'm interested in booking a Townley charter for ${formattedDate}.`;

    bookingText.href =
        `sms:${PHONE_NUMBER}?body=${encodeURIComponent(message)}`;

    dateSelection.hidden = false;

    /*
        Especially useful on mobile:
        bring the booking actions into view.
    */

    dateSelection.scrollIntoView({
        behavior: "smooth",
        block: "nearest"
    });
}


/*
    Clear currently selected date
*/

function clearSelection() {
    selectedButton = null;

    dateSelection.hidden = true;

    selectedDateText.textContent = "";
    selectedDateMessage.textContent = "";
}


/*
    yyyy-mm-dd

    We intentionally build this from local calendar fields,
    rather than using toISOString(), so dates don't shift
    because of UTC conversion.
*/

function formatDateKey(date) {
    const year = date.getFullYear();

    const month =
        String(date.getMonth() + 1)
            .padStart(2, "0");

    const day =
        String(date.getDate())
            .padStart(2, "0");

    return `${year}-${month}-${day}`;
}


/*
    November 18, 2026
*/

function formatLongDate(date) {
    return new Intl.DateTimeFormat(
        "en-US",
        {
            month: "long",
            day: "numeric",
            year: "numeric"
        }
    ).format(date);
}


function isAtMinimumMonth(){
    return (
        displayedYear === MIN_YEAR &&
        displayedMonth === MIN_MONTH
    );
}

function isAtMaximumMonth() {
    return (
        displayedYear === maxDate.getFullYear() &&
        displayedMonth === maxDate.getMonth()
    );
}

function updateNavigationButtons() {
    previousMonthButton.disabled = isAtMinimumMonth();
    nextMonthButton.disabled = isAtMaximumMonth();
}