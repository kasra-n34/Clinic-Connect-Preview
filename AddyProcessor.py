import pandas as pd

# Input and output file paths
input_file = "ontario_dentists_with_clinics_partial.csv"  # Replace with your input file name
output_file = "ontario_dentists_cleaned_and_grouped.csv"  # Output file name after cleaning and grouping

# Load the CSV file into a pandas DataFrame
df = pd.read_csv(input_file)

# Step 1: Remove rows where the Address is "N/A"
df = df[df["Address"] != "N/A"]
print(f"Removed rows with 'N/A' addresses. Remaining rows: {len(df)}")

# Step 2: Group by "Address" and aggregate Dentist Names and Clinic Names
grouped_df = df.groupby("Address").agg({
    "Dentist Name": lambda x: ", ".join(x.unique()),  # Combine unique dentist names
    "Clinic Name": lambda x: ", ".join(x.unique())   # Combine unique clinic names
}).reset_index()

# Save the grouped DataFrame to a new CSV file
grouped_df.to_csv(output_file, index=False)

print(f"Cleaned and grouped CSV saved to {output_file}.")
