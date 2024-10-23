import { useEffect, useRef, useState } from "react";
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
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input";
import { getDB, getAllRuleNodes, insertRootRuleNode, insertChildRuleNode } from "@/utils/db";
import { RuleNode } from "@/utils/rete-network";
import { useRulesContext } from "@/components/context";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem, CommandSeparator } from "@/components/ui/command";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

const formSchema = z.object({
    description: z.string().min(2),
    rule_option: z
        .string({
            required_error: "Please select an rule to use.",
        }),
    page: z.coerce.number().min(0),
    keyword: z.string(),
    previous_rule: z.string(),
    priority: z.coerce.number().min(0),
});

export function RuleForm() {
    const [open, setOpen] = useState(false)
    const [value, setValue] = useState("")
    const { rules, setRules } = useRulesContext();
    const db = useRef<any>(null);

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            description: '',
            page: 0,
            keyword: '',
            previous_rule: '',
            priority: 0,
        },
    });

    async function onSubmit(values: z.infer<typeof formSchema>) {
        console.log("Valori: ", values);
        let rule: RuleNode;
        if (values.previous_rule === '') {
            switch (values.rule_option) {
                case "keyword":
                    console.log('Keyword: ', values.keyword);
                    rule = new RuleNode(values.description, [{ "find": [{ "var": "query" }, values.keyword] }], values.page, values.priority);
                    insertRootRuleNode(db.current, rule);
                    const allNodes = await getAllRuleNodes(db.current);
                    rules.splice(0, rules.length);
                    allNodes.forEach((node) => {
                        setRules([...rules, { id: node.id, rule: node.rule, parent: node.parent }]);
                    });
                    console.table(allNodes);
                    break;
            }
        } else {
            rule = new RuleNode(values.description, [{ "find": [{ "var": "query" }, values.keyword] }], values.page, values.priority);
            console.log("ID of parent: ", values.previous_rule);
            insertChildRuleNode(db.current, rule, values.previous_rule);
            const allNodes = await getAllRuleNodes(db.current);
            allNodes.forEach((node) => {
                setRules([...rules, { id: node.id, rule: node.rule, parent: node.parent }]);
            });
            console.table(allNodes);
        }
    }

    useEffect(() => {
        const setup = async () => {
            db.current = await getDB();
        };
        setup();
    }, [rules]);

    return (
        <div>
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="w-2/3 space-y-6">
                    <FormField
                        control={form.control}
                        name="previous_rule"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>From rule</FormLabel>
                                <br />
                                {/* <Select disabled={rules.length === 0} onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select a previous rule" />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        {
                                            rules.map((rule, index) => {
                                                return (
                                                    <SelectItem key={index} value={rule.id}>
                                                        {rule.rule.name || "Unnamed Rule"}
                                                    </SelectItem>
                                                );
                                            })
                                        }
                                    </SelectContent>
                                </Select> */}
                                <FormControl>
                                    <Popover open={open} onOpenChange={setOpen}>
                                        <PopoverTrigger asChild>
                                            <Button
                                                variant="outline"
                                                role="combobox"
                                                aria-expanded={open}
                                                className="w-fit justify-between"
                                            >
                                                {value
                                                    ? rules.find((rule) => rule.id === value)?.rule.name
                                                    : "Select a rule..."}
                                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-[200px] p-0">
                                            <Command>
                                                <CommandInput placeholder="Search rule..." />
                                                <CommandList>
                                                    <CommandEmpty>No rule found.</CommandEmpty>
                                                    <CommandGroup>
                                                        {rules.map((rule) => (
                                                            <CommandItem
                                                                key={rule.id}
                                                                value={rule.rule.name}
                                                                onSelect={() => {
                                                                    setValue(rule.id)
                                                                    setOpen(false)
                                                                    field.onChange(rule.id)
                                                                }}
                                                            >
                                                                <Check
                                                                    className={cn(
                                                                        "mr-2 h-4 w-4",
                                                                        value === rule.id ? "opacity-100" : "opacity-0"
                                                                    )}
                                                                />
                                                                {rule.rule.name}
                                                            </CommandItem>
                                                        ))}
                                                    </CommandGroup>
                                                </CommandList>
                                            </Command>
                                        </PopoverContent>
                                    </Popover>
                                </FormControl>
                                <FormDescription>
                                    You can only choose one rule.
                                </FormDescription>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
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
                                <FormLabel>Condition</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select a condition type" />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        <SelectItem value="keyword">Keyword pattern</SelectItem>
                                        <SelectItem value="regex">Regex</SelectItem>
                                    </SelectContent>
                                </Select>
                                <FormDescription>
                                    You can only choose one rule.
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
                                        type="number"
                                        min={0}
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
                    <FormField
                        control={form.control}
                        name="priority"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Priority</FormLabel>
                                <FormControl>
                                    <Input
                                        type="number"
                                        min={0}
                                        placeholder="Priority"
                                        {...field}
                                    />
                                </FormControl>
                                <FormDescription>
                                    The priority of the rule.
                                </FormDescription>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <Button type="submit">Add rule</Button>
                </form>
            </Form>
        </div>
    );
}