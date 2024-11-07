import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { getAllRuleNodes, updateRuleNode } from "@/utils/db/db-rules";
import { getDB } from "@/utils/db/db-helper";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from "@/components/ui/command";
import { FormDescription } from "@/components/ui/form";
import { Rules } from "@/utils/interfaces";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { LogicEngine } from "json-logic-engine";
import { RuleNode } from "@/utils/rete-network";
import { getTotalPages } from "@/utils/db/db-documents";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

/**
 * Schema for the rule form.
 */
export const formSchema = z.object({
    description: z.string().min(2),
    rule_option: z.array(z.object({
        type: z.string(),
        value: z.string(),
        open: z.boolean(),
    })),
    page: z.coerce.number(),
    previous_rule: z.coerce.string(),
    priority: z.coerce.number().min(0),
    prompt: z.string().min(2),
});

/**
 * Renders a form for editing a rule.
 * @category Component
 */
export function EditRuleForm() {
    /** The rule ID from the URL. */
    const { ruleId } = useParams();

    /** The rule to be edited. */
    const [rule, setRule] = useState<any>(null);
    /** The rules to be displayed in the dropdown. */
    const [rules, setRules] = useState<Rules[]>([]);
    /** The conditions of the rule. */
    const [ruleConditions, setRuleConditions] = useState<{ type: string, value: string, open: boolean }[]>([]);
    /** The database instance. */
    const db = useRef<any>(null);
    /** Whether the popover is open. */
    const [open, setOpen] = useState(false);
    /** The value of the selected rule. */
    const [value, setValue] = useState<string>();
    /** Whether the condition popover is open. */
    const [conditionOpen, setConditionOpen] = useState(false);
    /** The condition to be edited. */
    const [condition, setCondition] = useState('');
    /** Whether the form is dirty. */
    const [isDirty, setIsDirty] = useState(false);
    /** The maximum page number. */
    const [maxPage, setMaxPage] = useState(0)
    /** The status of the rule. */
    const [status, setStatus] = useState<Status>("loading");

    /** The logic engine instance. */
    const logicEngine = new LogicEngine();
    logicEngine.addMethod("find", ([str, keyword]: [string, string]) => new RegExp(`\\b${keyword}\\b`, 'i').test(str));

    /**
     * Adds a rule to the rule conditions.
     */
    const addRule = useCallback(() => {
        setRuleConditions((prevConditions) => [...prevConditions, { type: '', value: '', open: false }]);
    }, []);

    /**
     * Updates a rule condition.
     */
    const updateRule = useCallback((index: number, field: 'type' | 'value', value: string, open: boolean) => {
        setRuleConditions((prevConditions) => {
            const updatedRules = [...prevConditions];
            updatedRules[index][field] = value;
            updatedRules[index].open = open;
            return updatedRules;
        });
    }, []);

    /**
     * Removes a rule condition.
     */
    const removeRule = useCallback((index: number) => {
        setRuleConditions((prevConditions) => prevConditions.filter((_, i) => i !== index));
    }, []);

    /**
     * Sets the allowed conditions for the rule.
     */
    const allowedConditions = useMemo(() => {
        if (typeof logicEngine.methods === 'object' && logicEngine.methods !== null) {
            return Object.keys(logicEngine.methods);
        } else {
            console.error("logicEngine.methods is not an object:", logicEngine.methods);
            return [];
        }
    }, [logicEngine.methods]);

    /**
     * Creates the form instance with the default values.
     */
    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            description: '',
            prompt: '',
            page: 0,
            rule_option: [],
            previous_rule: '',
            priority: 0,
        },
    });

    /**
     * Initializes the database instance.
     */
    useEffect(() => {
        const initDB = async () => {
            if (!db.current) {
                db.current = await getDB();
            }
        };
        initDB();
    }, []);

    /**
     * Adds a beforeunload listener to the window.
     */
    useEffect(() => {
        if (isDirty) {
            window.addEventListener('beforeunload', beforeUnloadListener);
            
            return () => {
                window.removeEventListener('beforeunload', beforeUnloadListener);
            };
        }
    }, [isDirty]);

    /**
     * The beforeunload listener.
     */
    const beforeUnloadListener = useCallback((event: BeforeUnloadEvent) => {
        event.preventDefault();
        event.returnValue = "Are you sure you want to exit?";
        return event.returnValue;
    }, []);

    /**
     * Fetches the rule from the database.
     */
    useEffect(() => {
        const fetchRule = async () => {
            setStatus("loading");
            try {
                if (!db.current) {
                    db.current = await getDB();
                }
                if (ruleId) {
                    const rules = await getAllRuleNodes(db.current);
                    const ruleData = rules.find((rule) => rule.id === ruleId);
                    setMaxPage(await getTotalPages(db.current))

                    if (ruleData) {
                        const conditions = ruleData.rule.conditions.map((condition: any) => ({
                            type: Object.keys(condition)[0],
                            value: condition[Object.keys(condition)[0]][1],
                            open: false,
                        }));

                        setRuleConditions(conditions);

                        setRules(rules.filter((rule) => rule.id !== ruleId && !rule.parent?.toString().includes(ruleId)));
                        setRule(ruleData);
                        setValue(ruleData.parent?.toString() || '');

                        form.reset({
                            description: ruleData.rule.name,
                            prompt: ruleData.rule.prompt,
                            rule_option: conditions,
                            previous_rule: ruleData.parent || '',
                            priority: ruleData.rule.salience,
                        });
                        setStatus("available");
                    } else {
                        setStatus("unavailable");
                    }
                } else {
                    setStatus("unavailable");
                }
            } catch (error) {
                console.error("Error fetching rule:", error);
                setStatus("failed to load");
            } finally {
                setStatus("available");
            }
        };
        fetchRule();
    }, [ruleId, form]);

    /**
     * Handles the form submission.
     */
    const onSubmit = async (values: z.infer<typeof formSchema>) => {
        try {
            const conditions = ruleConditions.map((ruleCondition) => ({
                [ruleCondition.type]: [{ "var": "query" }, ruleCondition.value]
            }));
            const rule = new RuleNode(values.description, conditions, values.prompt, values.page, values.priority);
            if (ruleId) {
                await updateRuleNode(db.current, ruleId, rule, values.previous_rule);
                console.log("Rule updated:", values);
                window.location.href = "/settings/rules";
            }
            toast.success('Rule updated.')
        } catch (error) {
            toast.error('Error updating rule.')
        }
    };

    /**
     * Renders the content based on the status.
     */
    const renderContent = () => {
        switch (status) {
            case "available":
                return (
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="w-2/3 space-y-6">
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
                                                        data-testid="from-rule-button"
                                                    >
                                                        {value && rules.find((rule: Rules) => rule.id === value)
                                                            ? rules.find((rule) => rule.id === value)?.rule.name
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
                                                                {rules.map((ruleItem) => (
                                                                    <CommandItem
                                                                        key={ruleItem.id}
                                                                        value={ruleItem.rule.name}
                                                                        onSelect={() => {
                                                                            setValue(ruleItem.id)
                                                                            setOpen(false)
                                                                            field.onChange(ruleItem.id)
                                                                        }}
                                                                    >
                                                                        <Check
                                                                            className={cn(
                                                                                "mr-2 h-4 w-4",
                                                                                value === ruleItem.id ? "opacity-100" : "opacity-0"
                                                                            )}
                                                                        />
                                                                        {ruleItem.rule.name}
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
                                            <Input placeholder="Rule name" {...field} data-testid="rule-description-input" />
                                        </FormControl>
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
                                                    placeholder="Enter condition value"
                                                    value={ruleCondition.value}
                                                    onChange={(e) => updateRule(index, 'value', e.target.value, ruleCondition.open)}
                                                    className="flex-grow"
                                                    data-testid="condition-value-input"
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
                                            You can choose multiple conditions.
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
                                        <FormLabel data-testid="return-page-label">Page</FormLabel>
                                        <FormControl>
                                            <Input type="number" {...field} data-testid="return-page-input" />
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
                                        <FormLabel data-testid="return-page-label">Prompt</FormLabel>
                                        <FormControl>
                                            <Textarea {...field} data-testid="textarea-prompt" />
                                        </FormControl>
                                        <FormDescription>
                                            The prompt to be returned if the rule is satisfied.
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
                                            <Input type="number" {...field} data-testid="priority-input" />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <Button type="submit">Update Rule</Button>
                        </form>
                    </Form>
                );
            case "unavailable":
                return <div>No rule found with specified ID</div>;
            case "loading":
                return <div>Loading...</div>;
            default:
                return <div>Unknown status</div>;
        }
    };

    return (
        <>
            {renderContent()}
        </>
    );
}
