# Diagnosis Debug Questions For User

1. For formula subtotal/total rows whose precedent cells are all blank, should the UI show a blank cell or `0`?
Answer: Blank cell.

2. When only `Millat - 2023.pdf` is uploaded, should the app display the comparative 2022 values that are present inside the 2023 annual report, or should it show only 2023?
Answer: It should show the values that are present inside the 2023 annual report.

3. Is it acceptable to modify and commit `backend_code/sample_docs/Millat - Template.xlsx` if the formula audit confirms incorrect formulas in the template?
Answer: Nope those formulas are correct and should not be modified.


4. For the reported project `a60885ed-1ad8-4a28-8676-bf85f208e632`, should we preserve existing saved draft versions, or is it acceptable to clean/regenerate that project's saved workbook JSON if it is proven stale/corrupt?
Answer: Don't regenerate the saved workbook JSON. I'll retest by uploading the 2023 annual report again.
