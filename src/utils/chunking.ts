import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';

/**
 * Interface for the text with page object.
 * @interface
 */
export interface TextWithPage {
    text: string;
    pageNumber: number;
}

/**
 * Interface for the chunk object.
 * @interface
 */
interface Chunk {
    index: number;
    page: number;
    text: string;
}

/**
 * Recursively chunks text with page boundaries.
 * @param {TextWithPage[]} textWithPages - An array of objects containing text and page numbers.
 * @param {number} chunkSize - The size of each chunk (default is 1024).
 * @param {number} chunkOverlap - The overlap between chunks (default is 300).
 * @returns {Promise<Chunk[]>} An array of Chunk objects.
 */
export async function recursiveChunkingWithPages(textWithPages: TextWithPage[], chunkSize = 1024, chunkOverlap = 300): Promise<Chunk[]> {
    let allText = "";
    const pageBoundaries: [number, number, number][] = [];
    let currentPosition = 0;

    textWithPages.forEach(({ text, pageNumber }) => {
        allText += text;
        pageBoundaries.push([currentPosition, currentPosition + text.length, pageNumber]);
        currentPosition += text.length;
    });

    const result = new RecursiveCharacterTextSplitter({
        chunkSize,
        chunkOverlap,
        lengthFunction: (text: string) => text.length,
        separators: ["\n\n", "\n", ".", "?", "!", " ", ""],
    }).createDocuments([allText]);

    const chunks = (await result).map((doc: any) => doc.pageContent);
    const chunkPageNumbers: number[] = [];

    chunks.forEach((chunk: string) => {
        const chunkStart = allText.indexOf(chunk);
        const chunkEnd = chunkStart + chunk.length;

        for (const [start, end, pageNumber] of pageBoundaries) {
            if (start <= chunkStart && chunkStart < end || start < chunkEnd && chunkEnd <= end) {
                chunkPageNumbers.push(pageNumber);
                break;
            }
        }
    });

    return chunks.map((chunk, i) => ({
        index: i,
        page: chunkPageNumbers[i],
        text: chunk
    }));
}