import React, { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Info } from "lucide-react";
import { WorkerMessageEvent } from "@/utils/interfaces";
import { getDB, initSchema, countRows } from "@/utils/db/db-helper";
import { seedSingleDb } from "@/utils/db/db-documents";
import ChatWorker from "@/workers/worker.ts?worker";
import axios from "axios";

import { recursiveChunkingWithPages } from "@/utils/chunking";

export default function DocumentForm() {
  const [progress, setProgress] = React.useState(0);
  const [processingMethod, setProcessingMethod] = useState<string>("chunked");
  const [files, setFiles] = useState<File[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const initailizing = useRef<boolean>(false);

  const worker = useRef<Worker | null>(null);
  const db = useRef<any>(null);
  const [message, setMessage] = useState<string>("");

  useEffect(() => {
    axios
      .get("/api/")
      .then((response) => setMessage(response.data.message))
      .catch((error) => console.error("Error fetching data", error));
  }, []);

  useEffect(() => {
    const setup = async () => {
      initailizing.current = true;
      db.current = await getDB();
      await initSchema(db.current);
      const count = await countRows(db.current, "chunks");
      console.log(`Found ${count} rows`);
    };
    if (!db.current && !initailizing.current) {
      setup();
    }
  }, []);

  useEffect(() => {
    if (!worker.current) {
      worker.current = new ChatWorker();
    }

    const onMessageReceived = async (e: WorkerMessageEvent) => {
      switch (e.data.status) {
        case "initiate":
          break;
        case "ready":
          break;
        case "embedding_complete": {
          setProgress(0);
          const result = e.data.output;
          console.log("Result: ", result);
          console.log("Seeding....");
          await seedSingleDb(db.current, result as any);
          setProgress(100);
          break;
        }
      }
    };

    worker.current.addEventListener("message", onMessageReceived);

    return () => {
      worker.current?.removeEventListener("message", onMessageReceived);
    };
  }, []);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (files.length === 0) return;

    setIsLoading(true);
    const formData = new FormData();
    
    console.log(`Processing ${files.length} files...`);
    files.forEach((file) => {
      formData.append("files", file);
      console.log(`Added file: ${file.name}`);
    });
    formData.append("method", processingMethod);

    try {
      setProgress(25);
      console.log("Sending files:", formData.get("files"));
      console.log("Sending method:", formData.get("method"));

      const response = await axios.post("/api/process-document", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
        baseURL: import.meta.env.VITE_API_URL || "",
        withCredentials: true,
        timeout: 30000,
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      });

      setProgress(50);
      const processedData = response.data;
      console.log("Processed Data: ", processedData);

      if (processedData.error) {
        throw new Error(processedData.error);
      }

      // Handle both chunked and unchunked responses
      const files = processingMethod === "chunked" 
        ? new Set(processedData.chunks?.map((chunk: any) => chunk.filename))
        : new Set(processedData.pages?.map((page: any) => page.filename));
      console.log("Successfully processed files:", Array.from(files));

      if (processingMethod === "chunked") {
        const chunks = await recursiveChunkingWithPages(processedData.chunks);
        console.log("Chunks: ", chunks);
      }

      worker.current?.postMessage({
        type: "process_chunks",
        data: { chunks: processedData.chunks },
      });
      
      setProgress(100);
    } catch (error) {
      console.error("Error processing PDF files:", error);
      setProgress(0);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = event.target.files;
    if (fileList) {
      setFiles(Array.from(fileList));
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Document Upload</CardTitle>
        <CardDescription>
          Upload PDF documents for processing and analysis
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="pdf-upload">PDF Files</Label>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Upload one or multiple PDF files for processing</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <Input
                type="file"
                id="pdf-upload"
                multiple
                accept=".pdf"
                onChange={handleFileChange}
                className="cursor-pointer"
              />
              {files.length > 0 && (
                <p className="text-sm text-muted-foreground">
                  {files.length} file(s) selected
                </p>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="processing-method">Processing Method</Label>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Choose how to process the PDF content</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <Select
                value={processingMethod}
                onValueChange={setProcessingMethod}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select processing method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="chunked">Chunked</SelectItem>
                  <SelectItem value="unchunked">Unchunked</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={files.length === 0 || isLoading}
            >
              {isLoading ? "Processing..." : "Process Files"}
            </Button>
          </div>

          {progress > 0 && (
            <div className="space-y-2">
              <Progress value={progress} />
              <p className="text-sm text-center text-muted-foreground">
                Processing: {progress}%
              </p>
            </div>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
