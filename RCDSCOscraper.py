from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.options import Options
from bs4 import BeautifulSoup
from concurrent.futures import ThreadPoolExecutor, as_completed

import csv
import time

# Path to ChromeDriver
CHROME_DRIVER_PATH = "/"

# Base URL of the RCDSO site
BASE_URL = "https://www.rcdso.org/find-a-dentist/search-results?Alpha=&City=&MbrSpecialty=&ConstitID=&District=&AlphaParent=&Address1=&PhoneNum=&SedationType=&SedationProviderType=&GroupCode=&DetailsCode="


def fetch_page_content_selenium(url):
    """Fetches the content of a webpage using Selenium in headless mode."""
    print(f"Fetching content from: {url}")

    # Configure Chrome options for headless mode
    chrome_options = Options()
    chrome_options.add_argument("--headless")  # Enable headless mode
    chrome_options.add_argument("--disable-gpu")  # Disable GPU acceleration (Windows-specific)
    chrome_options.add_argument("--no-sandbox")  # Bypass OS security model (Linux-specific)
    chrome_options.add_argument("--disable-dev-shm-usage")  # Prevent shared memory issues
    chrome_options.add_argument("--log-level=3")  # Suppress verbose logging
    chrome_options.add_argument("--window-size=1920,1080")  # Ensure correct rendering size

    # Start the driver with headless mode
    service = Service(CHROME_DRIVER_PATH)
    driver = webdriver.Chrome(service=service, options=chrome_options)
    driver.get(url)

    try:
        # Wait for the page to load by checking for the dentist's name or main content
        WebDriverWait(driver, 20).until(
            EC.presence_of_element_located((By.TAG_NAME, "main"))  # Use a reliable tag
        )
        print("Page content loaded successfully.")
    except Exception as e:
        print(f"Timeout or error occurred while loading: {url}")
        print(f"Error: {e}")
        driver.quit()
        return None

    page_source = driver.page_source
    driver.quit()
    return page_source



def scrape_dentists():
    """Scrapes the list of dentists and their profile links."""
    print("Starting to scrape dentist list...")
    dentists = []
    page_content = fetch_page_content_selenium(BASE_URL)
    
    soup = BeautifulSoup(page_content, "html.parser")
    
    # Find all dentist entries
    dentist_links = soup.select("section.row h2 a")  # Updated selector
    if not dentist_links:
        print("No dentist links found. Check the CSS selector.")
    else:
        print(f"Found {len(dentist_links)} dentist links.")

    for link in dentist_links:
        dentist_name = link.text.strip()
        dentist_detail_url = f"https://www.rcdso.org{link['href']}"
        print(f"Found dentist: {dentist_name}, Detail URL: {dentist_detail_url}")
        dentists.append({"name": dentist_name, "detail_url": dentist_detail_url})

    return dentists

def scrape_clinic_details(dentist):
    """Scrapes the clinic details from a dentist's profile page."""
    print(f"Fetching clinic details for: {dentist['name']}")
    page_content = fetch_page_content_selenium(dentist["detail_url"])
    
    if not page_content:
        print(f"Skipping {dentist['name']} due to missing or inaccessible page.")
        return []

    soup = BeautifulSoup(page_content, "html.parser")
    
    # Find the "All Practice Locations" section
    clinic_section = soup.find("section", id="OtherPractices")  # Adjusted based on screenshot
    clinics = []
    
    if clinic_section:
        # Extract all <li class="row"> elements, each representing a clinic
        clinic_rows = clinic_section.find_all("li", class_="row")
        for row in clinic_rows:
            # Extract clinic name
            clinic_name_tag = row.find("h6", class_="col-12")
            clinic_name = clinic_name_tag.text.strip() if clinic_name_tag else dentist["name"]  # Default to dentist name
            
            # Extract address from the <address> tag
            address_tag = row.find("address")
            if address_tag:
                address_lines = [span.text.strip() for span in address_tag.find_all("span")]
                address = ", ".join(address_lines)
            else:
                address = "Unknown Address"
            
            print(f"Extracted Clinic Name: {clinic_name}")
            print(f"Extracted Address: {address}")
            
            clinics.append({"Clinic Name": clinic_name, "Address": address})
    else:
        # If no clinic section is found, use the dentist's name as the clinic name
        print(f"No clinic section found for {dentist['name']}. Defaulting clinic name to dentist's name.")
        clinics.append({"Clinic Name": dentist["name"], "Address": "N/A"})
    
    return clinics





def save_to_csv(data, filename):
    """Saves the scraped data to a CSV file."""
    print(f"Saving scraped data to {filename}...")
    with open(filename, mode="w", newline="", encoding="utf-8") as file:
        writer = csv.DictWriter(file, fieldnames=["Dentist Name", "Clinic Name", "Address"])
        writer.writeheader()
        for row in data:
            writer.writerow(row)
    print(f"Data saved successfully to {filename}.")


def process_dentist(dentist):
    """Process a single dentist to fetch clinic details."""
    clinics = scrape_clinic_details(dentist)
    results = []
    if clinics:
        for clinic in clinics:
            results.append({
                "Dentist Name": dentist["name"],
                "Clinic Name": clinic["Clinic Name"],
                "Address": clinic["Address"]
            })
    else:
        results.append({
            "Dentist Name": dentist["name"],
            "Clinic Name": "No clinics found",
            "Address": "N/A"
        })
    return results

def get_processed_dentists(partial_csv):
    """Reads the partial CSV file and returns a set of processed dentist names."""
    processed_dentists = set()
    try:
        with open(partial_csv, mode="r", encoding="utf-8") as file:
            reader = csv.DictReader(file)
            for row in reader:
                processed_dentists.add(row["Dentist Name"])
        print(f"Loaded {len(processed_dentists)} already-processed dentists from {partial_csv}.")
    except FileNotFoundError:
        print(f"No partial CSV found. Starting fresh.")
    return processed_dentists


# Main execution
# Main execution
if __name__ == "__main__":
    print("Starting the scraping process with Selenium...")

    # Load already-processed dentists from the partial CSV
    processed_dentists = get_processed_dentists("ontario_dentists_with_clinics_partial.csv")

    # Scrape the list of dentists
    dentists = scrape_dentists()
    if not dentists:
        print("No dentists found. Exiting.")
        exit()

    # Filter out dentists that are already processed
    dentists_to_process = [d for d in dentists if d["name"] not in processed_dentists]
    print(f"{len(dentists_to_process)} dentists remaining to process out of {len(dentists)} total.")

    # Prepare to collect dentist and clinic data
    scraped_data = []
    total_clinics = 0  # Counter for total clinics
    batch_counter = 0  # Counter for saving partial data

    # Use ThreadPoolExecutor for multi-threaded scraping
    with ThreadPoolExecutor(max_workers=5) as executor:  # Adjust max_workers as needed
        future_to_dentist = {executor.submit(process_dentist, dentist): dentist for dentist in dentists_to_process}

        for future in as_completed(future_to_dentist):
            dentist = future_to_dentist[future]
            try:
                # Collect results for the processed dentist
                results = future.result()
                scraped_data.extend(results)
                total_clinics += len(results)  # Increment clinic count
                batch_counter += 1

                # Save a partial CSV after every 10 dentists processed
                if batch_counter % 10 == 0:
                    save_to_csv(scraped_data, "ontario_dentists_with_clinics_partial.csv")
                    save_to_csv(scraped_data, "ontario_dentists_with_clinics.csv")
                    print(f"Partial progress saved after processing {batch_counter} dentists.")

            except Exception as e:
                print(f"Error processing dentist {dentist['name']}: {e}")

    # Save the final scraped data to a CSV file
    save_to_csv(scraped_data, "ontario_dentists_with_clinics.csv")

    # Print summary of the scraping process
    print("\nScraping Summary:")
    print(f"Total dentists found: {len(dentists)}")
    print(f"Total clinics found: {total_clinics}")

    print("Scraping process completed. Data saved to 'ontario_dentists_with_clinics.csv'.")
