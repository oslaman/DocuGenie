import React, { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import axios from "axios";
import ChatWorker from "@/workers/worker.ts?worker";
import { getTotalChunks } from "@/utils/db/db-documents";
import { getDB } from "@/utils/db/db-helper";
import { seedSingleDb } from "@/utils/db/db-documents";

export default function DocumentForm() {
  const [progress, setProgress] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [excludeHeader, setExcludeHeader] = useState(false);
  const [excludeFooter, setExcludeFooter] = useState(false);
  const [headerThreshold, setHeaderThreshold] = useState(10);
  const [footerThreshold, setFooterThreshold] = useState(10);
  const [isFormDisabled, setIsFormDisabled] = useState(false);

  const worker = useRef<Worker | null>(null);
  const db = useRef<any>(null);
  const initializing = useRef(false);

  useEffect(() => {
    const setup = async () => {
      try {
        initializing.current = true;
        db.current = await getDB();
      } catch (error) {
        console.error("Error initializing database:", error);
      }
    };
    setup();
  }, []);

  useEffect(() => {
    if (!worker.current) {
      worker.current = new ChatWorker();
    }

    const onMessageReceived = async (e: MessageEvent) => {
      switch (e.data.status) {
        case "embedding_complete":
          setIsLoading(false);
          const result = e.data.output;
          console.log("Seeding...");
          await seedSingleDb(db.current, result);
          console.log("Seeded");
          toast.success("Embedding generation complete! Data saved to database.");
          setIsFormDisabled(true);
          break;
        case "error":
          setIsLoading(false);
          toast.error(`Error: ${e.data.error}`);
          break;
        default:
          break;
      }
    };

    worker.current.addEventListener("message", onMessageReceived);

    const checkExistingFiles = async () => {
      try {
        if (!db.current) db.current = await getDB();;
        const totalChunks = await getTotalChunks(db.current);
        if (totalChunks > 0) {
          setIsFormDisabled(true);
          toast.info("A file is already saved in the database. Form is disabled.");
        }
      } catch (error) {
        console.error("Error checking existing files:", error);
      }
    };

    checkExistingFiles();

    return () => {
      worker.current?.removeEventListener("message", onMessageReceived);
    };
  }, []);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!file) {
      toast.error("Please select a file");
      return;
    };

    setUploading(true);

    const formData = new FormData();
    let unsupportedFiles = false;

    if (unsupportedFiles) {
      setIsLoading(false);
      return;
    }


    formData.append("file", file);
    formData.append("header_threshold", headerThreshold.toString());
    formData.append("footer_threshold", footerThreshold.toString());
    formData.append("exclude_headers", excludeHeader.toString());
    formData.append("exclude_footers", excludeFooter.toString());

    const uploadPromise = async () => {
      try {
        const response = await fetch('http://localhost:8000/process-document', {
          method: 'POST',
          body: formData,
        });
  
        if (!response.ok) {
          throw new Error(`HTTP error! Status: ${response.status}`);
        }
  
        const responseResult = await response.json();
        worker.current?.postMessage({
              type: "process_chunks",
              data: { chunks: responseResult.chunks },
            });
      } catch (error) {
        console.log("Error uploading files:", error);
        throw error;
      } finally {
        setUploading(false);
      }
    }
    

    // try {
    //   const endpoint = "http://127.0.0.1:8000/api/process-document";
    //   const response = await fetch(endpoint, {
    //     method: 'POST',
    //     headers: {
    //       "Content-Type": "multipart/form-data",
    //     },
    //     body: formData,
    //     credentials: "include"
    //   });

    //   if (response.ok) {
    //     console.log(response);
    //     console.log("Files uploaded successfully!");
    //     // worker.current?.postMessage({
    //     //   type: "process_chunks",
    //     //   data: { chunks: response.data.chunks },
    //     // });
    //   } else {
    //     console.error("Error uploading files:");
    //   }
    // } catch (error) {
    //   console.log("Error uploading files:", error);
    //   throw error;
    // }

    // const uploadPromise = async () => {
    //   try {
    //     const response = await axios.post("/api/process-document", formData, {
    //       headers: {
    //         "Content-Type": "multipart/form-data",
    //       },
    //       baseURL: import.meta.env.VITE_API_URL,
    //       withCredentials: true,
    //       timeout: 120000,
    //       maxContentLength: Infinity,
    //       maxBodyLength: Infinity,
    //     });

    //     const processedData = response.data;
    //     if (processedData.error) {
    //       throw new Error(processedData.error);
    //     }
    //     toast.success("Files uploaded and processed successfully!");

    //   worker.current?.postMessage({
    //     type: "process_chunks",
    //     data: { chunks: processedData.chunks },
    //   });
    //   return processedData;
    //   } catch (error) {
    //     console.log("Error uploading files:", error);
    //     throw error;
    //   }
    // };

    toast.promise(uploadPromise(), {
      loading: `Uploading and processing files...`,
      success: () => {
        setFile(null);
        return `File processed successfully!`;
      },
      error: (err) => {
        setIsLoading(false);
        return `Failed to upload files: ${err.message}`;
      },
    });
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFile(e.target.files[0]);
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Upload Document</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <Label htmlFor="pdf-upload">Upload PDFs</Label>
            <Input
              id="pdf-upload"
              type="file"
              accept=".pdf"
              onChange={handleFileChange}
              className="mt-1"
              disabled={isFormDisabled}
            />
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="exclude-header"
              checked={excludeHeader}
              onCheckedChange={(checked) => setExcludeHeader(checked as boolean)}
              disabled={isFormDisabled}
            />
            <Label htmlFor="exclude-header">Exclude Header</Label>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="exclude-footer"
              checked={excludeFooter}
              onCheckedChange={(checked) => setExcludeFooter(checked as boolean)}
              disabled={isFormDisabled}
            />
            <Label htmlFor="exclude-footer">Exclude Footer</Label>
          </div>

          <div>
            <Label htmlFor="header-threshold">Header Threshold: {headerThreshold}%</Label>
            <Slider
              id="header-threshold"
              min={1}
              max={100}
              step={1}
              value={[headerThreshold]}
              onValueChange={(value) => setHeaderThreshold(value[0])}
              className="mt-2"
              disabled={isFormDisabled}
            />
          </div>

          <div>
            <Label htmlFor="footer-threshold">Footer Threshold: {100 - footerThreshold}%</Label>
            <Slider
              id="footer-threshold"
              min={1}
              max={100}
              step={1}
              value={[footerThreshold]}
              onValueChange={(value) => setFooterThreshold(value[0])}
              className="mt-2"
              disabled={isFormDisabled}
            />
          </div>

          <Button type="submit" className="w-full" disabled={isLoading || isFormDisabled}>
            Upload and Parse PDFs
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
