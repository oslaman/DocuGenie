import fitz  # PyMuPDF
import json
import time
from langchain.text_splitter import RecursiveCharacterTextSplitter
from sentence_transformers import SentenceTransformer



HEADER_THRESHOLD = 0.1  # 10% of the page
FOOTER_THRESHOLD = 0.9  # 90% of the page

EXCLUDE_HEADERS = True
EXCLUDE_FOOTERS = True

model = SentenceTransformer('thenlper/gte-small')

# Function to detect headers and footers
# It takes a pdf path and an optional exclude range,
# extracts the blocks for each page, sorts them by y-coordinate, 
# ignores the blocks within the header and footer thresholds
# and then creates a cropped pdf with the body of the pages,
# a json with the chunks and the page numbers and a text file with the body of the pages
def detect_headers_footers(pdf_path, exclude_range=None):
    document = fitz.open(pdf_path)
    page_rectangles = []
    cropped_document = fitz.open()
    text_with_pages = []
    exclude_pages = []

    try:    
        if exclude_range:
            exclude_pages = parse_range(exclude_range)
        else:
            exclude_pages = []
    except:
        print("Invalid range format. Please use comma-separated numbers or number ranges (e.g., 1,2,3-5).")
        return []

    for page_num in range(len(document)):
        page_to_exclude = page_num + 1
        if page_to_exclude in exclude_pages:
            continue
        
        page = document.load_page(page_num)
        blocks = page.get_text("blocks")
        blocks = sorted(blocks, key=lambda b: b[1])
        
        header_blocks = []
        footer_blocks = []
        body_blocks = []
        
        page_height = page.rect.height
        header_threshold = 0
        footer_threshold = page_height

        if EXCLUDE_HEADERS:
            header_threshold = page_height * HEADER_THRESHOLD
        
        if EXCLUDE_FOOTERS:
            footer_threshold = page_height * FOOTER_THRESHOLD
        
        for block in blocks:
            if block[1] < header_threshold:
                header_blocks.append(block)
            elif block[1] > footer_threshold:
                footer_blocks.append(block)
            else:
                body_blocks.append(block)

        if body_blocks:
            min_y = min(block[1] for block in body_blocks)
            max_y = max(block[3] for block in body_blocks)
        else:
            min_y = header_threshold
            max_y = footer_threshold
        
        rect = fitz.Rect(0, min_y, page.rect.width, max_y)
        page_rectangles.append(rect)
                
        cropped_page = page.set_cropbox(rect)
        cropped_document.insert_pdf(document, from_page=page_num, to_page=page_num)

        body_text = "\n".join([block[4] for block in body_blocks])
        text_with_pages.append((body_text, page_num + 1))

    cropped_output_path = "./output/cropped_output.pdf"
    cropped_document.save(cropped_output_path)
    cropped_document.close()

    chunks, chunk_page_numbers = recursive_chunking_with_pages(text_with_pages)

    metadata = {
        "title": document.metadata.get("title", "Unknown"),
        "author": document.metadata.get("author", "Unknown"),
        "num_pages": len(document),
        "num_chunks": len(chunks),
    }

    output_data = {
        "metadata": metadata,
        "chunks": [{ "index": i, "page": chunk_page_numbers[i], "text": chunk } for i, chunk in enumerate(chunks)]
    }

    return output_data


# Function to recursively chunk the text with page numbers
# It takes an array with a list of tuples, where each tuple contains the content of a page and it page number
# and returns an array with the chunks and the page numbers
def recursive_chunking_with_pages(text_with_pages, chunk_size=800, chunk_overlap=300):
    all_text = ""
    page_boundaries = []
    current_position = 0

    for text, page_number in text_with_pages:
        all_text += text
        page_boundaries.append((current_position, current_position + len(text), page_number))
        current_position += len(text)

    result = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
        length_function=len,
        is_separator_regex=False,
        separators=["\n\n", "\n", ".", "?", "!", " ", ""],
    ).create_documents([all_text])
    
    chunks = [doc.page_content for doc in result]
    chunk_page_numbers = []

    for chunk in chunks:
        chunk_start = all_text.find(chunk)
        chunk_end = chunk_start + len(chunk)

        for start, end, page_number in page_boundaries:
            if start <= chunk_start < end or start < chunk_end <= end:
                chunk_page_numbers.append(page_number)
                break

    return chunks, chunk_page_numbers



# Function to create embeddings for the chunks
# It takes the json with the chunks and the page numbers
# and returns the json with the chunks and the page numbers and the embeddings
def create_embeddings(data):
    for chunk in data['chunks']:
        chunk_content = chunk['text']
        embedding_vector = model.encode(chunk_content).tolist()
        chunk['embedding_of_chunk'] = embedding_vector 

    with open('output_embeddings.json', 'w', encoding='utf-8') as file:
        json.dump(data, file, ensure_ascii=False, indent=4)

    print("Embeddings generated and saved to output_embeddings.json")


# Function to parse a range string into a list of page numbers
def parse_range(astr):
    result=set()
    for part in astr.split(','):
        x=part.split('-')
        result.update(range(int(x[0]),int(x[-1])+1))
    return sorted(result)


def main():
    pdf_path = "./examples/meditations.pdf"
    exclude_range = "1-3,5"
    start_time = time.time()
    output_data = detect_headers_footers(pdf_path)
    end_time = time.time()

    print(f"Time taken for extraction: {end_time - start_time} seconds")

    with open('output/output.json', 'w', encoding='utf-8') as json_file:
        json.dump(output_data, json_file, ensure_ascii=False, indent=4)

    create_embeddings(output_data)
    

if __name__ == "__main__":
    main()