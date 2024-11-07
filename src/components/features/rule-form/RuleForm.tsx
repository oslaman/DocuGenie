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
import { Input } from "@/components/ui/input";
import { RuleNode } from "@/utils/rete-network";
import { useRulesContext } from "@/context/context";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from "@/components/ui/command";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { LogicEngine } from "json-logic-engine";
import { Rules } from "@/utils/interfaces";
import { X } from "lucide-react"
import { getDB } from '@/utils/db/db-helper';
import { getAllRuleNodes, insertRootRuleNode, insertChildRuleNode } from '@/utils/db/db-rules';
import { getTotalPages } from "@/utils/db/db-documents";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

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
    prompt: z.string(),
});

/**
 * Renders a form for creating a new rule.
 * @category Component
 */
export function RuleForm() {
    /** Whether the popover is open. */
    const [open, setOpen] = useState(false)
    /** The value of the selected rule. */
    const [value, setValue] = useState("")
    /** Whether the condition popover is open. */
    const [conditionOpen, setConditionOpen] = useState(false)
    /** The condition to be edited. */
    const [condition, setCondition] = useState("")
    /** The rules to be displayed in the dropdown. */
    const { rules, setRules } = useRulesContext();
    /** The conditions of the rule. */
    const [ruleConditions, setRuleConditions] = useState<{ type: string, value: string, open: boolean }[]>([]);
    /** The maximum page number allowed (The total number of pages in the database). */
    const [maxPage, setMaxPage] = useState(0);
    /** The database instance. */
    const db = useRef<any>(null);

    /** The logic engine instance. */
    const logicEngine = new LogicEngine();
    logicEngine.addMethod("find", ([str, keyword]: [string, string]) => new RegExp(`\\b${keyword}\\b`, 'i').test(str));

    /** Sets the allowed conditions for the rule. */
    let allowedConditions: string[] = [];
    if (typeof logicEngine.methods === 'object' && logicEngine.methods !== null) {
        Object.keys(logicEngine.methods).forEach((methodName) => {
            allowedConditions.push(methodName);
        });
    } else {
        console.error("logicEngine.methods is not an object:", logicEngine.methods);
    }

    /** The default values for the form. */
    let defaultValues = {
        description: '',
        page: 0,
        rule_option: '',
        keyword: '',
        previous_rule: '',
        priority: 0,
        prompt: 'Based on the context, answer the following question.',
    }

    /** Adds a rule to the rule conditions. */
    const addRule = () => {
        setRuleConditions([...ruleConditions, { type: '', value: '', open: false }]);
    }

    /** Updates a rule condition. */
    const updateRule = (index: number, field: 'type' | 'value', value: string, open: boolean) => {
        const updatedRules = [...ruleConditions];
        updatedRules[index][field] = value;
        updatedRules[index].open = open;
        setRuleConditions(updatedRules);
    }

    /** Removes a rule condition. */
    const removeRule = (index: number) => {
        const updatedRules = ruleConditions.filter((_, i) => i !== index)
        setRuleConditions(updatedRules)
    }

    /** The form instance. */
    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: defaultValues,
    });

    /** Handles the form submission. */
    async function onSubmit(values: z.infer<typeof formSchema>) {
        console.log("Valori: ", values);

        try {
            let rule: RuleNode;
            let conditions: any[] = [];
            ruleConditions.forEach((ruleCondition) => {
                conditions.push({ [ruleCondition.type]: [{ "var": "query" }, ruleCondition.value] });
            });
            rule = new RuleNode(values.description, conditions, values.prompt, values.page, values.priority);
            db.current = await getDB();

            if (values.previous_rule === '') {
                await insertRootRuleNode(db.current, rule);
            } else {
                await insertChildRuleNode(db.current, rule, values.previous_rule);
            }

            const allNodes = await getAllRuleNodes(db.current);
            const updatedRules = allNodes.map((node) => ({
                id: node.id,
                rule: node.rule,
                parent: node.parent
            }));

            setRules(updatedRules);

            form.reset(defaultValues);
            setValue('');
            setOpen(false);
            toast("Rule created", {
                description: new Date().toLocaleString(),
            })
        } catch (error) {
            toast.error('Error creating rule.')
        }
    }

    /** Initializes the database instance. */
    useEffect(() => {
        const setup = async () => {
            db.current = await getDB();
        };
        setup();
    }, [db]);

    /** Fetches the maximum number of pages from the database. */
    useEffect(() => {
        const getMaxPages = async () => {
            if (db.current) {
                setMaxPage(await getTotalPages(db.current))
            } else {
                db.current = await getDB()
                setMaxPage(await getTotalPages(db.current))
            }
        };

        getMaxPages();
    }, [maxPage])

    return (
        maxPage > 0 ?
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 w-full md:w-2/3">
                    <FormField
                        control={form.control}
                        name="previous_rule"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel data-testid="from-rule-label">Parent rule</FormLabel>
                                <br />
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
                                                    ? rules.find((rule) => rule.id === field.value)?.rule.name
                                                    : "Select a parent rule..."}
                                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-[200px] p-0">
                                            <Command>
                                                <CommandInput placeholder="Search rule..." />
                                                <CommandList>
                                                    <CommandEmpty>No rule found.</CommandEmpty>
                                                    {value && (
                                                        <CommandGroup>
                                                            <CommandItem
                                                                onSelect={() => {
                                                                    setValue('')
                                                                    setOpen(false)
                                                                }}
                                                                className="justify-center text-sm text-muted-foreground"
                                                            >
                                                                <X className="mr-2 h-4 w-4" />
                                                                Clear selection
                                                            </CommandItem>
                                                        </CommandGroup>
                                                    )}
                                                    <CommandGroup>
                                                        {rules.map((rule) => (
                                                            console.log("Rule: ", rule),
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
                                    You can only choose one parent rule.
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
                                <FormLabel data-testid="rule-description-label">Rule name</FormLabel>
                                <FormControl>
                                    <Input
                                        placeholder="Rule name"
                                        {...field}
                                    />
                                </FormControl>
                                <FormDescription>
                                    The name of the rule.
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
                                <FormLabel data-testid="condition-label">Conditions</FormLabel><br />
                                {ruleConditions.map((ruleCondition, index) => (
                                    <div key={index} className="flex items-center space-x-2">
                                        <Popover open={ruleCondition.open} onOpenChange={() => updateRule(index, "type", ruleCondition.type, !ruleCondition.open)}>
                                            <PopoverTrigger asChild>
                                                <Button
                                                    variant="outline"
                                                    role="combobox"
                                                    aria-expanded={ruleCondition.open}
                                                    className="w-fit justify-between"
                                                >
                                                    {ruleCondition.type
                                                        ? allowedConditions.find((conditionName) => conditionName === ruleCondition.type)
                                                        : "Select a condition type..."}
                                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-[200px] p-0">
                                                <Command>
                                                    <CommandInput placeholder="Search condition..." />
                                                    <CommandList>
                                                        <CommandEmpty>No condition found.</CommandEmpty>
                                                        {ruleCondition.type && (
                                                            <CommandGroup>
                                                                <CommandItem
                                                                    onSelect={() => {
                                                                        updateRule(index, 'type', '', !ruleCondition.open)
                                                                        setOpen(false)
                                                                    }}
                                                                    className="justify-center text-sm text-muted-foreground"
                                                                >
                                                                    <X className="mr-2 h-4 w-4" />
                                                                    Clear selection
                                                                </CommandItem>
                                                            </CommandGroup>
                                                        )}
                                                        <CommandGroup>
                                                            {allowedConditions.map((conditionName) => (
                                                                <CommandItem
                                                                    key={conditionName}
                                                                    value={conditionName}
                                                                    onSelect={() => {
                                                                        updateRule(index, 'type', conditionName, !ruleCondition.open)
                                                                        console.log("Rule condition: ", ruleCondition)
                                                                    }}
                                                                >
                                                                    <Check
                                                                        className={cn(
                                                                            "mr-2 h-4 w-4",
                                                                            condition === conditionName ? "opacity-100" : "opacity-0"
                                                                        )}
                                                                    />
                                                                    {conditionName}
                                                                </CommandItem>
                                                            ))}
                                                        </CommandGroup>

                                                    </CommandList>
                                                </Command>
                                            </PopoverContent>
                                        </Popover>
                                        <Input
                                            type="text"
                                            placeholder="Enter rule value"
                                            value={ruleCondition.value}
                                            onChange={(e) => updateRule(index, 'value', e.target.value, ruleCondition.open)}
                                            className="flex-grow"
                                        />
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => removeRule(index)}
                                            aria-label="Remove condition"
                                        >
                                            <X className="h-4 w-4" />
                                        </Button>
                                    </div>
                                ))}
                                <Button type="button" onClick={addRule}>Add condition</Button>
                                <FormDescription>
                                    You can add multiple conditions to the rule.
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
                                <FormLabel data-testid="priority-label">Priority</FormLabel>
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
                    <FormField
                        control={form.control}
                        name="page"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel data-testid="prompt-label">Page</FormLabel>
                                <FormControl>
                                    <Input
                                        type="number"
                                        min={0}
                                        placeholder="Page"
                                        {...field}
                                    />
                                </FormControl>
                                <FormDescription>
                                    The page to be returned if the rule is satisfied.
                                </FormDescription>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="prompt"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel data-testid="prompt-label">Prompt</FormLabel>
                                <FormControl>
                                    <Textarea
                                        placeholder="Prompt"
                                        {...field}
                                    />
                                </FormControl>
                                <FormDescription>
                                    The prompt of the rule.
                                </FormDescription>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <Button type="submit">Add rule</Button>
                </form>
            </Form> : <div>No pages found</div>
    );
}
