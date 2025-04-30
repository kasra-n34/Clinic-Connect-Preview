import requests
import pandas as pd
import time

# Replace with your Google API Key
API_KEY = ""

# Load the CSV file with clinic data
input_file = "ontario_dentists_cleaned_and_grouped.csv"
output_file = "clinics_with_details.csv"
df = pd.read_csv(input_file)

# Function to sanitize addresses
def sanitize_address(address):
    if pd.isna(address) or address.strip() == "":
        return None  # Skip blank addresses
    return ", ".join(address.split(",")[:2]).strip()  # Simplify to street and city

# Retry logic for transient API issues
def retry_request(url, params, max_retries=5):
    retries = 0
    backoff_time = 1  # Start with 1 second
    while retries < max_retries:
        response = requests.get(url, params=params)
        if response.status_code == 200:
            return response
        elif response.status_code == 429:  # Rate limit exceeded
            print(f"Rate limit exceeded. Retrying in {backoff_time} seconds...")
            time.sleep(backoff_time)
            backoff_time *= 2  # Exponential backoff
        else:
            break
        retries += 1
    return None

# Step 1: Get Place ID using Find Place API
def get_place_id(address):
    url = "https://maps.googleapis.com/maps/api/place/findplacefromtext/json"
    params = {
        "input": address,
        "inputtype": "textquery",
        "fields": "place_id,geometry",
        "key": API_KEY
    }
    response = retry_request(url, params)
    if response and response.status_code == 200:
        data = response.json()
        if data["status"] == "OK" and "candidates" in data and len(data["candidates"]) > 0:
            place = data["candidates"][0]
            return {
                "place_id": place["place_id"],
                "latitude": place["geometry"]["location"]["lat"],
                "longitude": place["geometry"]["location"]["lng"]
            }
        else:
            print(f"Failed to find place: {address}, Status: {data.get('status', 'Unknown')}")
            if "error_message" in data:
                print(f"Error Message: {data['error_message']}")
    return None

# Step 2: Get details using Place Details API
def get_place_details(place_id):
    url = "https://maps.googleapis.com/maps/api/place/details/json"
    params = {
        "place_id": place_id,
        "fields": "name,formatted_phone_number,website,opening_hours",
        "key": API_KEY
    }
    response = retry_request(url, params)
    if response and response.status_code == 200:
        data = response.json()
        if data["status"] == "OK":
            result = data["result"]
            return {
                "Phone": result.get("formatted_phone_number"),
                "Website": result.get("website"),
                "Hours": result.get("opening_hours", {}).get("weekday_text")
            }
        else:
            print(f"Failed to fetch details for place_id: {place_id}, Status: {data.get('status', 'Unknown')}")
            if "error_message" in data:
                print(f"Error Message: {data['error_message']}")
    return {
        "Phone": None,
        "Website": None,
        "Hours": None
    }

# Add new columns to the DataFrame
df["Latitude"] = None
df["Longitude"] = None
df["Phone"] = None
df["Website"] = None
df["Hours"] = None

# Fetch details for each address
for index, row in df.iterrows():
    raw_address = row["Address"]
    sanitized_address = sanitize_address(raw_address)
    if not sanitized_address:
        print(f"Skipping invalid address: {raw_address}")
        continue

    print(f"Fetching Place ID for: {sanitized_address}")
    place_data = get_place_id(sanitized_address)
    if place_data:
        df.at[index, "Latitude"] = place_data["latitude"]
        df.at[index, "Longitude"] = place_data["longitude"]

        print(f"Fetching details for Place ID: {place_data['place_id']}")
        details = get_place_details(place_data["place_id"])
        df.at[index, "Phone"] = details["Phone"]
        df.at[index, "Website"] = details["Website"]
        df.at[index, "Hours"] = "; ".join(details["Hours"]) if details["Hours"] else None

    time.sleep(1)  # To respect API rate limits

# Save the updated DataFrame to a new CSV file
df.to_csv(output_file, index=False)
print(f"Details fetching completed. Results saved to {output_file}.")
