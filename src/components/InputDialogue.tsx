import React from "react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Textarea } from "./ui/textarea";

const formSchema = z.object({
  prompt: z.string().min(2),
});

interface InputDialogueProps {
  classify: (text: string) => void;
  prompt: string;
  setPrompt: React.Dispatch<React.SetStateAction<string>>;
}

export function InputDialogue({ classify, prompt, setPrompt }: InputDialogueProps) {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      prompt: prompt,
    },
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    console.log("Valori: ",values);
    setPrompt(values.prompt);
    classify(values.prompt);
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <FormField
          control={form.control}
          name="prompt"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Your request</FormLabel>
              <FormControl>
                <Textarea 
                  placeholder="Ask me anything" 
                  {...field} 
                />
              </FormControl>
              <FormDescription>
                Here you can ask me anything about the document.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit">Submit</Button>
      </form>
    </Form>
  );
}