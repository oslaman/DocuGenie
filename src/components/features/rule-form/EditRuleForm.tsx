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

export const formSchema = z.object({
    description: z.string().min(2),
    rule_option: z.array(z.object({
        type: z.string(),
        value: z.string(),
        open: z.boolean(),
    })),
    page: z.coerce.number().min(0),
    previous_rule: z.coerce.string(),
    priority: z.coerce.number().min(0),
});

export function EditRuleForm() {
    const { ruleId } = useParams();
    const [rule, setRule] = useState<any>(null);
    const [rules, setRules] = useState<Rules[]>([]);
    const [ruleConditions, setRuleConditions] = useState<{ type: string, value: string, open: boolean }[]>([]);
    const db = useRef<any>(null);
    const [open, setOpen] = useState(false);
    const [value, setValue] = useState<string>();
    const [conditionOpen, setConditionOpen] = useState(false);
    const [condition, setCondition] = useState('');
    const [isDirty, setIsDirty] = useState(false);
    const [maxPage, setMaxPage] = useState(0)

    const logicEngine = new LogicEngine();
    logicEngine.addMethod("find", ([str, keyword]: [string, string]) => new RegExp(`\\b${keyword}\\b`, 'i').test(str));

    const addRule = useCallback(() => {
        setRuleConditions((prevConditions) => [...prevConditions, { type: '', value: '', open: false }]);
    }, []);

    const updateRule = useCallback((index: number, field: 'type' | 'value', value: string, open: boolean) => {
        setRuleConditions((prevConditions) => {
            const updatedRules = [...prevConditions];
            updatedRules[index][field] = value;
            updatedRules[index].open = open;
            return updatedRules;
        });
    }, []);

    const removeRule = useCallback((index: number) => {
        setRuleConditions((prevConditions) => prevConditions.filter((_, i) => i !== index));
    }, []);

    const allowedConditions = useMemo(() => {
        if (typeof logicEngine.methods === 'object' && logicEngine.methods !== null) {
            return Object.keys(logicEngine.methods);
        } else {
            console.error("logicEngine.methods is not an object:", logicEngine.methods);
            return [];
        }
    }, [logicEngine.methods]);

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            description: '',
            page: 0,
            rule_option: [],
            previous_rule: '',
            priority: 0,
        },
    });

    useEffect(() => {
        const initDB = async () => {
            if (!db.current) {
                db.current = await getDB();
            }
        };
        initDB();
    }, []);

    useEffect(() => {
        window.onbeforeunload = beforeUnloadListener;
    }, []);

    const beforeUnloadListener = (event: any) => {
        event.preventDefault();
        return event.returnValue = "Are you sure you want to exit?";
    };

    useEffect(() => {
        const fetchRule = async () => {
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
                            page: ruleData.rule.actionValue,
                            rule_option: conditions,
                            previous_rule: ruleData.parent || '',
                            priority: ruleData.rule.salience,
                        });
                    }
                }
            } catch (error) {
                console.error("Error fetching rule:", error);
            }
        };
        fetchRule();
    }, [ruleId, form]);

    const onSubmit = async (values: z.infer<typeof formSchema>) => {
        const conditions = ruleConditions.map((ruleCondition) => ({
            [ruleCondition.type]: [{ "var": "query" }, ruleCondition.value]
        }));
        const rule = new RuleNode(values.description, conditions, values.page, values.priority);
        if (ruleId) {
            await updateRuleNode(db.current, ruleId, rule, values.previous_rule);
            console.log("Rule updated:", values);
            window.location.href = "/settings/rules";
        }
    };

    return (
        maxPage > 0 ?
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="w-2/3 space-y-6">
                <FormField
                    control={form.control}
                    name="previous_rule"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel data-testid="from-rule-label">From rule</FormLabel>
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
                            <FormLabel data-testid="rule-description-label">Rule description</FormLabel>
                            <FormControl>
                                <Input placeholder="Rule description" {...field} data-testid="rule-description-input" />
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
                            <FormLabel data-testid="condition-label">Condition</FormLabel><br />
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
                                <Input type="number" {...field} data-testid="return-page-input" max={maxPage} />
                            </FormControl>
                            <FormDescription>
                                The max value is the total number of pages ({maxPage}).
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
            </Form> : <div>No pages found</div>
    );
}
