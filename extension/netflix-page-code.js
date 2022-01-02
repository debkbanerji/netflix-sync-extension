function embeddedCode() {
    // Have to define constants in this function since it needs to be serialized
    // to be embedded

    const MS_IN_SEC = 1000;

    const TIME_BEFORE_RUN = 1.0 * MS_IN_SEC; // Give Netflix this much time to load

    const SYNC_GMT_TIMESTAMP_PARAM = "syncGMTTimestampSec";
    const SYNC_GMT_NUM_TIMESTAMP_REGEX = new RegExp(
        "[\\?&]" + SYNC_GMT_TIMESTAMP_PARAM + "=\\d*"
    );

    const SYNC_VIDEO_TIMESTAMP_PARAM = "syncVideoTimestampSec";
    const SYNC_VIDEO_NUM_TIMESTAMP_REGEX = new RegExp(
        "[\\?&]" + SYNC_VIDEO_TIMESTAMP_PARAM + "=\\d*"
    );

    const USE_NETWORK_TIME = false; // TODO: FIX WITHIN PAGE
    const GMT_URL = "https://worldtimeapi.org/api/timezone/Europe/London";

    // how far ahead actual time is relative to system time
    let currentTimeToActualGMTOffset = 0;

    // netflix player session Id
    let playerSessionId;

    /* Countdown timer HTML IDs (these elements are dynamically modified)*/
    const COUNTDOWN_TIMER_DIV_ID = "countdown-timer-div"; // removed after party starts
    const COUNTDOWN_TIMER_H2_ID = "countdown-timer-h2"; // updated every second until party starts

    let timerInserted = false;

    /* Notification div ID */
    const NOTIF_DIV_ID = "notif-div";   // container div
    const NOTIF_P_ID = "notif-message"; // where the message text is stored
    const NOTIF_I_ID = "notif-icon" // spinning refresh icon

    // Netflix HTML element class where custom elements will be inserted
    // Adding within this <div> ensures the children are visible in fullscreen mode, and Netflix font's are inherited
    const NETFLIX_MOUNT_CLASS = "watch-video"; 

    // try to update currentTimeToActualGMTOffset
    let headers = new Headers();
    // headers.append('Content-Type', 'application/json');
    // headers.append('Accept', 'application/json');
    // headers.append('Origin','https://www.netflix.com');
    // headers.append('Access-Control-Allow-Origin', 'https://www.netflix.com');
    // headers.append('Access-Control-Allow-Methods', 'GET');
    // headers.append('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    fetch(GMT_URL, {mode: 'cors', method: 'GET', credentials: 'include', headers: headers})
        .then(response => {
            return response.json();
        })
        .then(data => {
            if (data.unixtime) {
                currentTimeToActualGMTOffset =
                    data.unixtime - Date.now() / MS_IN_SEC;
            }
        });

    function getVideoPlayer() {
        return netflix.appContext.state.playerApp.getAPI().videoPlayer;
    }

    function getPlayer() {
        try {
            const videoPlayer = getVideoPlayer();

            // Getting player id
            playerSessionId = videoPlayer.getAllPlayerSessionIds()[0];

            const player = videoPlayer.getVideoPlayerBySessionId(
                playerSessionId
            );

            return player;
        } catch (err) {
            alert("Netflix link sync unable to access player on page");
            console.error(err);
        }
    }

    const onSyncFunction = (player, syncGMTTs, syncVideoTargetTs) => {
        // only sync if video is playing
        if (
            !playerSessionId ||
            getVideoPlayer().isVideoPlayingForSessionId(playerSessionId)) {
            const MAX_DESYNC_DELTA = 3 * MS_IN_SEC;

            // recalculate these
            const currentGMTTs =
                Date.now() / MS_IN_SEC + currentTimeToActualGMTOffset;
            // time between now and when the video should start
            const timeToVideoStartSec =
                syncGMTTs - currentGMTTs - syncVideoTargetTs;
            const timeToVideoStartMs = timeToVideoStartSec * MS_IN_SEC;
            const targetPlayerTime = -1 * timeToVideoStartMs;

            const currentPlayerTime = player.getCurrentTime();
            const delta = Math.abs(targetPlayerTime - currentPlayerTime);
            if (delta && delta > MAX_DESYNC_DELTA) {
                // resync
                player.seek(targetPlayerTime);
                player.play();
                flashNotif("Syncing...", 1750, true);
                // alert the viewer if the video has already ended
                if (player.isEnded()) {
                    alert("The scheduled video has ended");
                }
            }
        }
    };

    /*
    Utility method to convert JSON holding CSS attributes to string
  */
    function createStyleString(cssObj) {
        return JSON.stringify(cssObj)
            .split(",")
            .join(";")
            .split('"')
            .join("")
            .slice(1, -1);
    }

    function createCountdownTimer() {
        // styling for the countdown timer div
        let divCss = {
            position: "absolute",
            "margin-top": "40px",
            left: "50%",
            transform: "translateX(-50%) scale(2)",
            color: "white",
            "z-index": "9999999",
            "background-color": "black",
            "border-radius": "10px",
            border: "red",
            "border-style": "solid",
            "text-align": "center",
            "padding-left": ".83em",
            "padding-right": ".83em",
            visibility: "hidden"
        };
        let div = document.createElement("div"); // enclosing countdown timer div
        let h2 = document.createElement("h2"); // remaining time text
        let h3 = document.createElement("h4"); // message
        h2.innerText = "00:00";
        h2.id = COUNTDOWN_TIMER_H2_ID;
        h3.innerText = "Until your Netflix Sync Party starts";
        div.appendChild(h2);
        div.appendChild(h3);
        div.id = COUNTDOWN_TIMER_DIV_ID;
        div.style = createStyleString(divCss);
        try {
            document
                .getElementsByClassName(NETFLIX_MOUNT_CLASS)
                .item(0)
                .appendChild(div);
            timerInserted = true;
        } catch (err) {
            console.error("Unable to add countdown timer to DOM. NETFLIX_MOUNT_CLASS:" + NETFLIX_MOUNT_CLASS);
            console.error(err);
        }
    }

    function createNotifDiv() {
        let divCss = {
            position: "absolute",
            "margin-top": "15px",
            left: "50%",
            transform: "translateX(-50%) scale(1)",
            color: "white",
            "z-index": "9999999",
            "text-align": "center",
            "padding-left": ".5em",
            "padding-right": ".5em",
            // "box-shadow": "0px 0px 3px red",
            transition: "opacity .5s",
            visibility: "visible",
            opacity: "0",
        };
        let pCss = {
            "margin-block-start": ".3em",
            "margin-block-end": ".3em",
            "margin-left": ".3em",
            "margin-right":".3em",
            "font-size": "2.2em",
            "display": "inline",
        }
        let div = document.createElement("div");
        let p = document.createElement("p");
        let i = document.createElement("i");

        p.id = NOTIF_P_ID;
        p.innerText = "Syncing...";
        p.style = createStyleString(pCss);

        // add Font Awesome to head element
        let fontAwesome = document.createElement("link");
        fontAwesome.setAttribute("rel", "stylesheet");
        fontAwesome.setAttribute("href", "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/4.7.0/css/font-awesome.min.css");
        document.getElementsByTagName("head")[0].appendChild(fontAwesome);
        // add sync (refresh) icon from Font Awesome
        i.setAttribute("class", "fa fa-refresh fa-spin fa-2x fa-fw");
        i.id = NOTIF_I_ID;

        let span = document.createElement("span");
        span.appendChild(i); //add icon
        span.appendChild(p); //add message

        div.id = NOTIF_DIV_ID;
        div.style = createStyleString(divCss);
        div.appendChild(i);
        div.appendChild(span);
        try {
            document
                .getElementsByClassName(NETFLIX_MOUNT_CLASS)
                .item(0)
                .appendChild(div);
        } catch (err) {
            console.error("Unable to add " + NOTIF_DIV_ID + " to DOM. NETFLIX_MOUNT_CLASS:" + NETFLIX_MOUNT_CLASS);
            console.error(err);
        }
    }

    function flashNotif(message, timeInMs, showIcon) {
        /* flashes a notification in NOTIF_DIV_ID */
        try {
            document.getElementById(NOTIF_P_ID).innerText = message;
            document.getElementById(NOTIF_DIV_ID).style.opacity = 1;
            document.getElementById(NOTIF_I_ID).style.visibility = (showIcon) ? "visible" : "hidden";
            setTimeout(()=>{document.getElementById(NOTIF_DIV_ID).style.opacity = 0;}, timeInMs);
        } catch (err) {
            console.error("unable to flash notification");
            console.error(err);
        }
    }

    function onNetflixLoad() {
        createNotifDiv();

        const url = window.location.href;
        const syncGMTTs = parseInt(
            SYNC_GMT_NUM_TIMESTAMP_REGEX.exec(url)[0].split("=")[1]
        );
        // default to assuming the video should start at 0
        let syncVideoTargetTs = 0;
        try {
            // try to read time from url
            syncVideoTargetTs = parseInt(
                SYNC_VIDEO_NUM_TIMESTAMP_REGEX.exec(url)[0].split("=")[1]
            );
        } catch (err) {
            // ignore error - just use 0 as the default
        }

        const player = getPlayer();

        const currentGMTTs = Date.now() / MS_IN_SEC;
        // time between now and when the video should start
        const timeToVideoStartSec =
            syncGMTTs - currentGMTTs - syncVideoTargetTs;
        const timeToVideoStartMs = timeToVideoStartSec * MS_IN_SEC;

        const TIME_TO_SCHEDULE = 3 * MS_IN_SEC;
        const SYNC_INTERVAL_MS = 3 * MS_IN_SEC;

        if (timeToVideoStartMs > 0) {
            // video should not start yet - reset and schedule the start
            setTimeout(function() {
                const player = getPlayer();
                player.seek(0);
                player.pause();
                createCountdownTimer(); //add countdown timer to DOM
                if (timerInserted) {
                    //start countdown
                    let remainingTime = timeToVideoStartMs - TIME_TO_SCHEDULE;
                    var updateTimer = setInterval(() => {
                        if (
                            document.getElementById(COUNTDOWN_TIMER_DIV_ID).style
                                .visibility === "hidden"
                        ) {
                            document.getElementById(
                                COUNTDOWN_TIMER_DIV_ID
                            ).style.visibility = "visible";
                        }
                        //update timer
                        remainingTime -= MS_IN_SEC;
                        let min = Math.floor(remainingTime / (1000 * 60));
                        let sec = Math.floor(remainingTime / 1000) % 60;
                        min = min < 10 ? "0" + min : min;
                        sec = sec < 10 ? "0" + sec : sec;
                        let countdownStr = min.toString() + ":" + sec.toString();
                        document.getElementById(
                            COUNTDOWN_TIMER_H2_ID
                        ).innerText = countdownStr;
                    }, 1000);
                }
                setTimeout(function() {
                    if (timerInserted) {
                        //remove timer, end countdown
                        document.getElementById(COUNTDOWN_TIMER_DIV_ID).remove(); //remove timer
                        timerInserted = false;
                        if (typeof updateTimer !== "undefined") {
                            clearInterval(updateTimer);
                        }
                    }
                    player.play();
                    setInterval(
                        onSyncFunction,
                        SYNC_INTERVAL_MS,
                        player,
                        syncGMTTs,
                        syncVideoTargetTs
                    );
                }, timeToVideoStartMs - TIME_TO_SCHEDULE);
            }, TIME_TO_SCHEDULE);
        } else {
            setInterval(
                onSyncFunction,
                SYNC_INTERVAL_MS,
                player,
                syncGMTTs,
                syncVideoTargetTs
            );
        }
    }

    setTimeout(function() {
        onNetflixLoad();
    }, TIME_BEFORE_RUN);
}

// Required so we can access the Netflix player and other page elements
function embedInPage(fn) {
    const script = document.createElement("script");
    script.text = `(${fn.toString()})();`;
    document.documentElement.appendChild(script);
}

// Define these ones here as well since we need to use these to check whether
// or not we need to embed code in the first place
const SYNC_GMT_TIMESTAMP_PARAM = "syncGMTTimestampSec";
const SYNC_GMT_TIMESTAMP_REGEX = new RegExp(
    "[\\?&]" + SYNC_GMT_TIMESTAMP_PARAM + "=([^&#]*)"
);

const url = window.location.href;

// Only embed the code in the page if at least the GMT timestamp exists
// Ex 1: https://www.netflix.com/watch/70079583?syncGMTTimestampSec=1584939579&syncVideoTimestampSec=1200
// Ex 2: https://www.netflix.com/watch/70079583?syncGMTTimestampSec=1584939579
if (SYNC_GMT_TIMESTAMP_REGEX.test(url)) {
    embedInPage(embeddedCode);
}
