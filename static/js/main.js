// class RangeLoader extends Hls.DefaultConfig.loader {
//     load(context, config, callbacks) {
//         if (context.responseType === 'arraybuffer' && context.url.endsWith('.ts')) {
//             // Only for .ts segments
//             context.rangeStart = 0;
//             context.rangeEnd = 500000; // request first 500KB
//         }
//         super.load(context, config, callbacks);
//     }
// }
let currentTimelineStartSegment = null;
let suppressSliderUpdate = false;
let livestreaming = false;



function shutdownCamService() {
    fetch('/shutdown_cam_service', {
        method: 'GET',
    }).then((response) => {
        var errMsg = document.getElementById('error-message');
        errMsg.innerHTML = "Killed Car Cam.";
    });
}

function restartCamService() {
    fetch('/restart_cam_service', {
        method: 'GET',
    })
    .then(response => response.json())
    .then(data => {
        var errMsg = document.getElementById('error-message');
        if (data.status === 'ok') {
            errMsg.innerHTML = "Restarted Car Cam Service.";
            errMsg.style.color = "green";
        } else {
            errMsg.innerHTML = "Failed to restart service.";
            errMsg.style.color = "red";
        }
    })
    .catch(err => {
        var errMsg = document.getElementById('error-message');
        errMsg.innerHTML = "Error restarting service.";
        errMsg.style.color = "red";
        console.error(err);
    });
}

function updateTimelineSlider(initial = false) {
    fetch('/segment_count')
        .then(response => response.json())
        .then(data => {
            const slider = document.getElementById('timelineSlider');

            slider.max = data.latest_segment;

            if (initial || livestreaming) {
                syncTimelineSliderWithLatest();
            } else if (currentTimelineStartSegment === data.latest_segment) {
                slider.value = data.latest_segment;
            }
        });
}

function syncTimelineSliderWithLatest() {
    const slider = document.getElementById('timelineSlider');
    const latestSegment = parseInt(slider.max);  // reuse the latest known value from periodic update
    // Update internal tracking
    currentTimelineStartSegment = latestSegment;
    suppressSliderUpdate = true;
    // Sync slider to live edge
    slider.value = latestSegment;
}

function displayError(message) {
    var errorMessage = document.getElementById('error-message');
    errorMessage.textContent = 'Error: ' + message;
    console.error(message);

    setTimeout(clearError, 3000); // Clear after 10 seconds
}
function clearError() {
    var errorMessage = document.getElementById('error-message');
    errorMessage.textContent = '';
}

function updateServiceStatus() {
    fetch('/service_status')
        .then(response => response.json())
        .then(data => {
            const statusText = document.getElementById('status-text');
            if (data.status === 'active') {
                statusText.textContent = 'active';
                statusText.style.color = 'green';
            } else {
                statusText.textContent = data.status || 'unknown';
                statusText.style.color = 'red';
            }
        })
        .catch(error => {
            console.error('Error fetching service status:', error);
            const statusText = document.getElementById('status-text');
            statusText.textContent = 'unreachable';
            statusText.style.color = 'red';
        });
}

///////////////////////////////////////////////////////////////////////////////////////////////////////
///// START DOMContentLoaded
document.addEventListener('DOMContentLoaded', function() {
    var video = document.getElementById('video');
    var playHlsButton = document.getElementById('play-hls-button');
    
    var streamUrl = '/livestream.m3u8';
    var hls;



    const hlsConfig = {
        liveSyncDuration: 1, // Time in seconds to sync live edge
        liveMaxLatencyDuration: 3, // Maximum latency in seconds behind the live edge
        lowLatencyMode: true, // Enable low-latency streaming
        maxBufferLength: 10,
        maxMaxBufferLength: 10,
        maxBufferHole: 0.1,
    };
    // const hlsConfig = {
    //     loader: RangeLoader,
    //     maxBufferLength: 10,
    //     maxMaxBufferLength: 10,
    //     maxBufferHole: 0.1,
    //     lowLatencyMode: true,
    //     liveSyncDuration: 1,
    //     liveMaxLatencyDuration: 3,
    // };

    // Function to initialize the HLS player
    function initializeHlsPlayer(sourceUrl) {
        if (Hls.isSupported()) {
            if (hls) {
                hls.destroy(); // Destroy any existing instance before creating a new one
            }
            hls = new Hls(hlsConfig);
            hls.loadSource(sourceUrl);
            hls.attachMedia(video);

            hls.on(Hls.Events.MANIFEST_PARSED, function() {
                console.log('Manifest parsed, ready to play');
                video.play().catch(function(error) {
                    displayError('Playback error: ' + error.message);
                });
            });
            // hls.on(Hls.Events.FRAG_LOADING, (event, data) => {
            //     console.log('Loading segment:', data.frag.url);
            // });
            hls.on(Hls.Events.ERROR, function(event, data) {
                if (data.fatal) {
                    switch (data.type) {
                        case Hls.ErrorTypes.NETWORK_ERROR:
                            displayError('Network error: ' + data.details);
                            hls.startLoad();
                            break;
                        case Hls.ErrorTypes.MEDIA_ERROR:
                            displayError('Media error: ' + data.details);
                            hls.recoverMediaError();
                            break;
                        default:
                            displayError('Unrecoverable error: ' + data.details);
                            hls.destroy();
                            break;
                    }
                } else {
                    console.warn('Non-fatal error occurred: ', data);
                }
            });
        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
            video.src = sourceUrl;
            video.play().catch(function(error) {
                displayError('Playback error: ' + error.message);
            });
        } else {
            displayError('Your browser does not support HLS playback');
        }
    }

    // Play HLS Stream button event listener
    playHlsButton.addEventListener('click', function() {
        clearError(); // Clear any previous error messages
        syncTimelineSliderWithLatest();
        livestreaming = true;
        initializeHlsPlayer(streamUrl);
    });

    document.getElementById('timelineSlider').addEventListener('change', function() {
        const startSegment = parseInt(this.value);
        currentTimelineStartSegment = startSegment;
        suppressSliderUpdate = true;
        livestreaming = false;
        initializeHlsPlayer(`/timeline.m3u8?start=${startSegment}`);
    });

    updateServiceStatus();
    updateTimelineSlider(true);
    syncTimelineSliderWithLatest(); // call once here

    setInterval(() => {
        const video = document.getElementById('video');
        const slider = document.getElementById('timelineSlider');

        if (!video || !slider || currentTimelineStartSegment === null) return;

        if (video.readyState >= 2 && !suppressSliderUpdate) {
            const currentSegment = currentTimelineStartSegment + Math.floor(video.currentTime / 2);
            slider.value = currentSegment;
        }

        // Only suppress the user-set sync once
        if (suppressSliderUpdate) suppressSliderUpdate = false;
    }, 1000);

});

///// END DOMContentLoaded
///////////////////////////////////////////////////////////////////////////////////////////////////////
setInterval(updateServiceStatus, 5000);
setInterval(updateTimelineSlider, 5000);