let geoJsonLayer;
    let geoJsonLayerVisible = true;
    let clinicMarkers = []; // Array to hold clinic markers
    let markerCluster; // MarkerClusterer instance
    let directionsService; // For calculating routes
    let directionsRenderer; // For displaying routes
    let userLocation = { lat: 43.6532, lng: -79.3832 }; // Default location (e.g., Toronto)
    
    function getBreakpointColor(density) {
        if (density == null || density <= 0) return '#FFFFFF'; // White for no data or zero density
      
        // Apply logarithmic scaling (add 1 to avoid log(0))
        const logDensity = Math.log10(density + 1);
      
        // Define finer color ranges for the log scale
        if (logDensity <= 0.5) return '#FFFFE0'; // Very Light Yellow
        if (logDensity <= 1) return '#FFFFB2'; // Light Yellow
        if (logDensity <= 1.5) return '#FED976'; // Yellow
        if (logDensity <= 2) return '#FEB24C'; // Orange
        if (logDensity <= 2.5) return '#FD8D3C'; // Dark Orange
        if (logDensity <= 3) return '#FC4E2A'; // Red
        if (logDensity <= 3.5) return '#E31A1C'; // Dark Red
        if (logDensity <= 4) return '#BD0026'; // Deeper Red
        return '#800026'; // Very Deep Red for higher values
      }
      
  
  
  

  // Function to interpolate between two colors
  function interpolateColor(color1, color2, factor) {
    const hexToRgb = (hex) =>
      hex
        .replace(/^#/, '')
        .match(/.{2}/g)
        .map((x) => parseInt(x, 16));

    const rgbToHex = (rgb) =>
      `#${rgb
        .map((x) => Math.round(x).toString(16).padStart(2, '0'))
        .join('')}`;

    const c1 = hexToRgb(color1);
    const c2 = hexToRgb(color2);
    const interpolated = c1.map((c, i) => c + factor * (c2[i] - c));
    return rgbToHex(interpolated);
  }

  let minDensity = Infinity;
  let maxDensity = -Infinity;
  
  function loadGeoJson() {
    fetch('population_density.geojson')
      .then((response) => response.json())
      .then((geoJson) => {
        // Add GeoJSON data to the map
        geoJsonLayer = map.data.addGeoJson(geoJson);
  
        // Calculate min and max density values for debugging/logging
        geoJson.features.forEach((feature) => {
          const density = feature.properties.population_density;
          if (density != null && density > 0) {
            minDensity = Math.min(minDensity, density);
            maxDensity = Math.max(maxDensity, density);
          }
        });
  
        console.log(`Logarithmic Scaling Applied. Density Range: Min = ${minDensity}, Max = ${maxDensity}`);
  
        // Apply styles using log-based colors
        toggleGeoJsonLayer();
        addLegendLogarithmic();
      })
      .catch((error) => console.error('Error loading GeoJSON:', error));
  }
  function addLegendLogarithmic() {
    const legend = document.getElementById('legend');
    const legendContent = document.getElementById('legend-content');
  
    // Clear previous legend content
    legendContent.innerHTML = '';
  
    // Define finer logarithmic ranges and corresponding colors
    const legendItems = [
      { color: '#FFFFE0', label: '1 - 3 people/km²' },
      { color: '#FFFFB2', label: '3 - 10 people/km²' },
      { color: '#FED976', label: '10 - 31 people/km²' },
      { color: '#FEB24C', label: '31 - 100 people/km²' },
      { color: '#FD8D3C', label: '100 - 316 people/km²' },
      { color: '#FC4E2A', label: '316 - 1,000 people/km²' },
      { color: '#E31A1C', label: '1,000 - 3,162 people/km²' },
      { color: '#BD0026', label: '3,162 - 10,000 people/km²' },
      { color: '#800026', label: '> 10,000 people/km²' },
    ];
  
    // Populate the legend dynamically
    legendItems.forEach((item) => {
      const li = document.createElement('li');
      const colorBox = document.createElement('span');
      colorBox.style.backgroundColor = item.color;
      li.appendChild(colorBox);
      li.appendChild(document.createTextNode(item.label));
      legendContent.appendChild(li);
    });
  
    // Add legend to the map
    map.controls[google.maps.ControlPosition.LEFT_BOTTOM].push(legend);
  }
  
  
  
  function initMap() {
    // Initialize the map centered on Ontario
    map = new google.maps.Map(document.getElementById("map"), {
      center: { lat: 44.0000, lng: -79.0000 }, // Approximate center of Ontario
      zoom: 5,
    });
  
    // Load saved addresses from localStorage
    loadSavedAddresses();
  
    // Load GeoJSON and calculate density range
    loadGeoJson();
  
    // Call toggleGeoJsonLayer initially to hide the overlay
    toggleGeoJsonLayer();
  
    // Add an event listener for zoom changes
    map.addListener("zoom_changed", () => {
        const currentZoom = map.getZoom();
        const minZoomToShowOverlay = 6; // Example threshold
      
        if (geoJsonLayerVisible) {
          // Adjust visibility based on zoom level without toggling state
          map.data.setStyle((feature) => {
            const density = feature.getProperty('population_density');
            const color = getBreakpointColor(density);
            return {
              fillColor: color,
              fillOpacity: currentZoom >= minZoomToShowOverlay ? 0.6 : 0, // Lower opacity at lower zoom levels
              strokeWeight: 0.5,
              strokeColor: '#000000',
              visible: currentZoom >= minZoomToShowOverlay,
            };
          });
        }
      });
      
  
    // Add a click event listener to set a new home location
    document.getElementById("set-location").addEventListener("click", updateHomeLocation);
  
    // Add a click event listener for the toggle button
    document.getElementById("toggle-button").addEventListener("click", toggleGeoJsonLayer);
  
    // Load clinic markers from the saved clinics .csv file
    loadClinicsFromFile();
  }
  
function updateMarkerVisibility() {
  const currentZoom = map.getZoom();

  let minZoomToShowMarkers = 5

  const shouldShowMarkers = currentZoom >= minZoomToShowMarkers;

  // Loop through all clinic markers and toggle their visibility
  clinicMarkers.forEach((marker) => {
    marker.setVisible(shouldShowMarkers);
  });
}

    // Function to update the user's home location
    function updateHomeLocation() {
      const geocoder = new google.maps.Geocoder();
      const address = document.getElementById("home-location").value;

      if (!address) {
        alert("Please enter a valid location.");
        return;
      }

      geocoder.geocode({ address }, (results, status) => {
        if (status === "OK") {
          const location = results[0].geometry.location;
          userLocation = { lat: location.lat(), lng: location.lng() };

          // Add a marker for the home location
          new google.maps.Marker({
            position: userLocation,
            map: map,
            title: "Home Location",
            icon: {
              path: google.maps.SymbolPath.CIRCLE,
              scale: 8,
              fillColor: "blue",
              fillOpacity: 1,
              strokeColor: "white",
              strokeWeight: 2,
            },
          });

          map.setCenter(userLocation); // Center the map on the new home location
          alert(`Home location updated to: ${results[0].formatted_address}`);
        } else {
          alert("Geocoding failed: " + status);
        }
      });
    }

    // Function to calculate distance and travel time
    function calculateCommuteTime(origin, destination, callback) {
        const service = new google.maps.DistanceMatrixService();
        service.getDistanceMatrix(
          {
            origins: [origin],
            destinations: [destination],
            travelMode: 'DRIVING',
          },
          (response, status) => {
            if (status === 'OK') {
              const result = response.rows[0].elements[0];
              const distance = result.distance.text;
              const duration = result.duration.text;
              callback({ distance, duration });
            } else {
              console.error('Distance Matrix request failed:', status);
            }
          }
        );
      }
      

    // Function to display driving directions
    function displayDirections(origin, destination) {
      const request = {
        origin,
        destination,
        travelMode: 'DRIVING',
      };

      directionsService.route(request, (result, status) => {
        if (status === 'OK') {
          directionsRenderer.setDirections(result);
        } else {
          console.error('Directions request failed:', status);
        }
      });
    }

    function displayCommuteTime(marker, clinicLocation, row) {
        if (!userLocation) {
          console.warn("Home location not set. Unable to calculate commute time.");
          return;
        }
      
        calculateCommuteTime(userLocation, clinicLocation, ({ distance, duration }) => {
          // Extract relevant data from the row
          const clinicName = row['Clinic Name'] || 'Unknown Clinic'; // Fallback to 'Unknown Clinic'
          const dentistNames = row['Dentist Name'] || 'N/A'; // Handle missing dentist names gracefully
          const address = row['Address'] || 'N/A';
          const phone = row['Phone'] || 'N/A';
          const website = row['Website']
            ? `<a href="${row['Website']}" target="_blank">${row['Website']}</a>`
            : 'N/A';
          const hours = row['Hours'] || 'N/A';
      
          // Create the InfoWindow content
          const infoWindowContent = `
            <div>
              <h3>${clinicName}</h3> <!-- Display Clinic Name as the title -->
              <p><strong>Dentists:</strong> ${dentistNames}</p> <!-- List Dentist Names -->
              <p><strong>Address:</strong> ${address}</p>
              <p><strong>Distance:</strong> ${distance}</p>
              <p><strong>Duration:</strong> ${duration}</p>
              <button id="save-address-btn">Save Address</button>
            </div>
          `;
      
          // Create and open the InfoWindow
          const infoWindow = new google.maps.InfoWindow({
            content: infoWindowContent,
          });
      
          infoWindow.open(map, marker);
      
          // Attach event listener for saving the address
          google.maps.event.addListenerOnce(infoWindow, 'domready', () => {
            document.getElementById('save-address-btn').addEventListener('click', () => {
              saveAddress(marker);
            });
          });
        });
      }
      
    function loadClinicsFromFile() {
        console.log("Starting to load clinics from the CSV file...");
      
        // Fetch the CSV file
        fetch('clinics_with_details_cleaned.csv')
          .then((response) => response.text())
          .then((csvText) => {
            console.log("CSV file content loaded. Parsing with PapaParse...");
      
            Papa.parse(csvText, {
              header: true, // Automatically parse headers
              skipEmptyLines: true, // Skip empty rows
              complete: (results) => {
                console.log("CSV parsing completed. Processing rows...");
                const rows = results.data;
      
                rows.forEach((row, rowIndex) => {
                  console.log(`Processing row ${rowIndex + 1}:`, row);
      
                  // Extract latitude and longitude
                  const latRaw = row['Latitude'];
                  const lngRaw = row['Longitude'];
      
                  console.log(`Raw latitude and longitude for row ${rowIndex + 1}:`, { latRaw, lngRaw });
      
                  const lat = parseFloat(latRaw);
                  const lng = parseFloat(lngRaw);
      
                  console.log(`Parsed coordinates for row ${rowIndex + 1}:`, { lat, lng });
      
                  // Skip rows with missing or invalid coordinates
                  if (isNaN(lat) || isNaN(lng)) {
                    console.warn(`Row ${rowIndex + 1} is missing valid coordinates and was skipped.`);
                    return;
                  }
      
                  // Create a marker for valid rows
                  const marker = new google.maps.Marker({
                    position: { lat, lng },
                    title: row['Dentist Name'] || 'Unknown Clinic', // Default to 'Unknown Clinic' if no name
                    map: map,
                  });
      
                  console.log(`Marker created for row ${rowIndex + 1}:`, marker);
      
                  // Add click event to show details and commute time
                  marker.addListener('click', () => {
                    displayCommuteTime(marker, { lat, lng }, row);
                  });
      
                  clinicMarkers.push(marker); // Store the marker for clustering
                });
      
                console.log(`Total valid markers created: ${clinicMarkers.length}`);
      
                // Add clustering to the map
                if (clinicMarkers.length > 0) {
                  markerCluster = new markerClusterer.MarkerClusterer({
                    map: map,
                    markers: clinicMarkers,
                  });
                  console.log(`Marker clustering added with ${clinicMarkers.length} markers.`);
                } else {
                  console.warn('No valid clinic markers found.');
                }
              },
              error: (error) => {
                console.error('Error parsing the CSV file:', error);
              },
            });
          })
          .catch((error) => {
            console.error('Error fetching the CSV file:', error);
          });
      }
      

function toggleGeoJsonLayer() {
  // Toggle the state
  geoJsonLayerVisible = !geoJsonLayerVisible;

  // Update the GeoJSON layer visibility
  if (geoJsonLayerVisible) {
    // Show the GeoJSON layer
    map.data.setStyle((feature) => {
      const density = feature.getProperty('population_density');
      const color = getBreakpointColor(density);
      return {
        fillColor: color,
        fillOpacity: 0.6,
        strokeWeight: 0.5,
        strokeColor: '#000000',
        visible: true,
      };
    });
  } else {
    // Hide the GeoJSON layer
    map.data.setStyle(() => ({ visible: false }));
  }

  // Update the button's appearance and text
  const toggleButton = document.getElementById('toggle-button');
  if (geoJsonLayerVisible) {
    toggleButton.classList.remove('toggle-off');
    toggleButton.classList.add('toggle-on');
    toggleButton.innerText = 'Hide Population Density Overlay';
  } else {
    toggleButton.classList.remove('toggle-on');
    toggleButton.classList.add('toggle-off');
    toggleButton.innerText = 'Show Population Density Overlay';
  }
}

  


  function applyDensityFilter() {
  const minDensity = parseFloat(document.getElementById("min-density").value);
  const maxDensity = parseFloat(document.getElementById("max-density").value);

  map.data.setStyle((feature) => {
    const density = feature.getProperty('population_density');
    
    if (density === null || isNaN(minDensity) || isNaN(maxDensity)) {
      return { visible: false }; // Hide if density or thresholds are invalid
    }

    if (density >= minDensity && density <= maxDensity) {
      const color = getBreakpointColor(density);
      return {
        fillColor: color,
        fillOpacity: 0.6,
        strokeWeight: 0.5,
        strokeColor: "#000000",
      };
    } else {
      return { visible: false }; // Hide features outside the range
    }
  });
}

function clearDensityFilter() {
  // Clear the input fields
  document.getElementById("min-density").value = '';
  document.getElementById("max-density").value = '';

  // Reset the GeoJSON layer styles to show all features
  map.data.setStyle((feature) => {
    const density = feature.getProperty('population_density');
    const color = getBreakpointColor(density);

    return {
      fillColor: color,
      fillOpacity: 0.6,
      strokeWeight: 0.5,
      strokeColor: "#000000",
    };
  });
}

function calculateDistance(lat1, lng1, lat2, lng2) {
  const toRad = (value) => (value * Math.PI) / 180;
  const R = 6371; // Earth's radius in kilometers

  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in kilometers
}

function applyRadiusFilter() {
  const radius = parseFloat(document.getElementById("radius").value);

  if (isNaN(radius) || radius <= 0) {
    alert("Please enter a valid radius.");
    return;
  }

  // Loop through clinic markers and calculate distance from user location
  clinicMarkers.forEach((marker) => {
    const markerPosition = marker.getPosition();
    const distance = calculateDistance(
      userLocation.lat,
      userLocation.lng,
      markerPosition.lat(),
      markerPosition.lng()
    );

    // Show or hide the marker based on the radius
    marker.setVisible(distance <= radius);
  });
}

function clearRadiusFilter() {
  // Reset the radius input field
  document.getElementById("radius").value = '';

  // Make all markers visible
  clinicMarkers.forEach((marker) => marker.setVisible(true));
}

let savedAddresses = []; // Array to hold saved addresses

function saveAddress(marker) {
  const address = marker.title || 'Unknown Address';

  if (!savedAddresses.some((item) => item.address === address)) {
    savedAddresses.push({ address, lat: marker.getPosition().lat(), lng: marker.getPosition().lng() }); // Save address and marker's lat/lng

    // Save to localStorage
    localStorage.setItem('savedAddresses', JSON.stringify(savedAddresses));

    // Change marker icon to gold
    marker.setIcon({
      path: google.maps.SymbolPath.CIRCLE,
      scale: 10,
      fillColor: "gold",
      fillOpacity: 1,
      strokeColor: "black",
      strokeWeight: 1,
    });

    // Add to the sidebar
    const li = document.createElement('li');
    li.textContent = address;

    // Add a click event to zoom into the marker
    li.addEventListener('click', () => {
      map.setZoom(15); // Set zoom level
      map.setCenter(marker.getPosition()); // Center the map on the marker
    });

    // Add a remove button
    const removeBtn = document.createElement('button');
    removeBtn.textContent = 'Remove';
    removeBtn.onclick = () => {
      // Remove address from saved list
      savedAddresses = savedAddresses.filter((item) => item.address !== address);
      li.remove();

      // Update localStorage
      localStorage.setItem('savedAddresses', JSON.stringify(savedAddresses));

      // Revert marker to default icon
      marker.setIcon({
        path: google.maps.SymbolPath.CIRCLE,
        scale: 8,
        fillColor: "blue",
        fillOpacity: 1,
        strokeColor: "white",
        strokeWeight: 2,
      });
    };

    li.appendChild(removeBtn);
    document.getElementById('saved-addresses').appendChild(li);
    console.log(`Address saved: ${address}`);
  } else {
    alert('This address is already saved.');
  }
}




function clearSavedAddresses() {
  savedAddresses = [];
  const list = document.getElementById('saved-addresses');
  list.innerHTML = ''; // Clear the list in the sidebar
  console.log('All saved addresses cleared.');
}

function loadSavedAddresses() {
  const saved = localStorage.getItem('savedAddresses');
  if (saved) {
    savedAddresses = JSON.parse(saved);

    // Iterate over saved addresses and re-add them to the sidebar and map
    savedAddresses.forEach((item) => {
      const marker = new google.maps.Marker({
        position: { lat: item.lat, lng: item.lng },
        map: map,
        title: item.address,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 10,
          fillColor: "gold",
          fillOpacity: 1,
          strokeColor: "black",
          strokeWeight: 1,
        },
      });

      // Add to the sidebar
      const li = document.createElement('li');
      li.textContent = item.address;

      // Add a click event to zoom into the marker
      li.addEventListener('click', () => {
        map.setZoom(15); // Set zoom level
        map.setCenter(marker.getPosition()); // Center the map on the marker
      });

      // Add a remove button
      const removeBtn = document.createElement('button');
      removeBtn.textContent = 'Remove';
      removeBtn.onclick = () => {
        // Remove address from saved list
        savedAddresses = savedAddresses.filter((savedItem) => savedItem.address !== item.address);
        li.remove();

        // Update localStorage
        localStorage.setItem('savedAddresses', JSON.stringify(savedAddresses));

        // Revert marker to default icon
        marker.setIcon({
          path: google.maps.SymbolPath.CIRCLE,
          scale: 8,
          fillColor: "blue",
          fillOpacity: 1,
          strokeColor: "white",
          strokeWeight: 2,
        });

        marker.setMap(null); // Remove marker from map
      };

      li.appendChild(removeBtn);
      document.getElementById('saved-addresses').appendChild(li);
    });
  }
}


  

// Add an event listener for the Clear All button
document.getElementById('clear-saved').addEventListener('click', clearSavedAddresses);

// Add event listener for the density filter button
document.getElementById("apply-density-filter").addEventListener("click", applyDensityFilter);

// Add event listener for the "Clear Filter" button
document.getElementById("clear-density-filter").addEventListener("click", clearDensityFilter);

document.getElementById("apply-radius-filter").addEventListener("click", applyRadiusFilter);
document.getElementById("clear-radius-filter").addEventListener("click", clearRadiusFilter);


window.onload = initMap;