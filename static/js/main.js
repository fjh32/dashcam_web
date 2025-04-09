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

function shutdownCamService() {
    fetch('/shutdown_cam_service', {
        method: 'GET',
    }).then((response) => {
        var errMsg = document.getElementById('error-message');
        errMsg.innerHTML = "Killed Car Cam.";
    });
}

function populateRecordingList() {
    const recordingListElement = document.getElementById('recordingList');
    
    // Check if any radio button is currently selected and store its value
    const selectedRadio = document.querySelector('input[name="recording"]:checked');
    const selectedValue = selectedRadio ? selectedRadio.value : null;

    // Fetch JSON data from /recording_list
    fetch('/recording_list')
        .then(response => response.json()) // Parse the response as JSON
        .then(data => {
            // Clear all contents of the <ul> element before repopulating it
            recordingListElement.innerHTML = "";

            // Ensure data is an array of strings
            if (Array.isArray(data)) {
                // Loop through each recording and create list items with radio buttons
                data.forEach(recording => {
//                    if (!recording.includes('output')) {
                        const listItem = document.createElement('li');
                        const radio = document.createElement('input');
                        const label = document.createElement('label');

                        // Set up the radio button attributes
                        radio.type = 'radio';
                        radio.name = 'recording'; // All radio buttons share the same name
                        radio.value = recording;
                        radio.id = recording; // Set an ID for the label

                        // Check if this radio should be selected based on the previous selection
                        if (recording === selectedValue) {
                            radio.checked = true;
                        }

                        // Set up the label for the radio button
                        label.textContent = recording;
                        label.htmlFor = recording;

                        // Append the radio button and label to the list item
                        listItem.appendChild(radio);
                        listItem.appendChild(label);
                        recordingListElement.appendChild(listItem);
                    //}
                });
            }
        })
        .catch(error => {
            console.error('Error fetching the recording list:', error);
        });
}


// Function to get the selected recording and set the video player source
function getSelectedRecording() {
    const radios = document.getElementsByName('recording');
    let selectedValue = null;

    // Loop through radio buttons to find the selected one
    radios.forEach(radio => {
        if (radio.checked) {
            selectedValue = radio.value;
        }
    });

    if (selectedValue) {
        if (hls) {
            hls.destroy(); // Destroy HLS instance to free the video element
            hls = null;
        }
        // Set the video player source to the selected recording
        const video = document.getElementById('video');
        video.src = `/recordings/${selectedValue}`;
        video.load();  // Reload the video to reflect the new source
        alert('Selected recording: ' + selectedValue);
    } else {
        alert('No recording selected.');
    }
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

document.addEventListener('DOMContentLoaded', function() {
    var video = document.getElementById('video');
    var playRecordingButton = document.getElementById('play-recording-button');
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

    // Play Selected Recording button event listener
    playRecordingButton.addEventListener('click', function() {
        clearError();
        const radios = document.getElementsByName('recording');
        let selectedValue = null;
    
        radios.forEach(radio => {
            if (radio.checked) {
                selectedValue = radio.value;
            }
        });
    
        if (selectedValue) {
            const video = document.getElementById('video');
            if (selectedValue.endsWith('.m3u8')) {
                initializeHlsPlayer(`/recordings/${selectedValue}`);
            } else {
                video.src = `/recordings/${selectedValue}`;
                video.load();
                video.play().catch(function(error) {
                    displayError('Playback error: ' + error.message);
                });
            }
        } else {
            displayError('No recording selected.');
        }
    });

    // Play HLS Stream button event listener
    playHlsButton.addEventListener('click', function() {
        clearError(); // Clear any previous error messages
        initializeHlsPlayer(streamUrl);
    });


    populateRecordingList();
});

setInterval(populateRecordingList, 3000);
