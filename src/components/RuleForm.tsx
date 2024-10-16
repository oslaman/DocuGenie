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
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input";
import { rule } from "postcss";

const formSchema = z.object({
    description: z.string().min(2),
    rule_option: z
    .string({
      required_error: "Please select an rule to use.",
    }),
    page: z.number(),
    keyword: z.string(),
});

interface InputDialogueProps {
    classify: (text: string) => void;
    prompt: string;
    setPrompt: React.Dispatch<React.SetStateAction<string>>;
}

export function InputDialogue() {
    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            description: '',
        },
    });

    function onSubmit(values: z.infer<typeof formSchema>) {
        console.log("Valori: ", values);
    }

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Rule description</FormLabel>
                            <FormControl>
                                <Input
                                    placeholder="Rule description"
                                    {...field}
                                />
                            </FormControl>
                            <FormDescription>
                                The description of the rule.
                            </FormDescription>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="rule_option"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Email</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select a verified email to display" />
                                    </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                    <SelectItem value="keyword">Keyword pattern</SelectItem>
                                </SelectContent>
                            </Select>
                            <FormDescription>
                                You can choose one of the rules.
                            </FormDescription>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                {form.watch("rule_option") === "keyword" ? <FormField
                    control={form.control}
                    name="keyword"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Keyword</FormLabel>
                            <FormControl>
                                <Input
                                    placeholder="Hello"
                                    {...field}
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                /> : null}
                <FormField
                    control={form.control}
                    name="page"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Return page</FormLabel>
                            <FormControl>
                                <Input
                                    placeholder="Page number"
                                    {...field}
                                />
                            </FormControl>
                            <FormDescription>
                                The max value is the total number of pages.
                            </FormDescription>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <Button type="submit">Add rule</Button>
            </form>
        </Form>
    );
}