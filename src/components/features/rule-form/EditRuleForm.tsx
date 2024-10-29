import { useEffect, useState, useRef } from "react";
import { useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { getAllRuleNodes, getRuleById, updateRuleNode } from "@/utils/db/db-rules";
import { getDB } from "@/utils/db/db-helper";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from "@/components/ui/command";
import { FormDescription } from "@/components/ui/form";
import { Rules } from "@/utils/interfaces";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { LogicEngine } from "json-logic-engine";
import { RuleNode } from "@/utils/rete-network";

export const formSchema = z.object({
    description: z.string().min(2),
    rule_option: z.string(),
    page: z.coerce.number().min(0),
    keyword: z.string(),
    previous_rule: z.string(),
    priority: z.coerce.number().min(0),
});

export function EditRuleForm() {
    const { ruleId } = useParams();
    const [rule, setRule] = useState<any>(null);
    const [rules, setRules] = useState<Rules[]>([]);
    const db = useRef<any>(null);
    const [open, setOpen] = useState(false);
    const [value, setValue] = useState<string>();
    const [conditionOpen, setConditionOpen] = useState(false);
    const [condition, setCondition] = useState('');

    const logicEngine = new LogicEngine();
    logicEngine.addMethod("find", ([str, keyword]: [string, string]) => new RegExp(`\\b${keyword}\\b`, 'i').test(str));


    let allowedConditions: string[] = [];
    if (typeof logicEngine.methods === 'object' && logicEngine.methods !== null) {
        Object.keys(logicEngine.methods).forEach((methodName) => {
            allowedConditions.push(methodName);
        });
    } else {
        console.error("logicEngine.methods is not an object:", logicEngine.methods);
    }

    let defaultValues = {
        description: '',
        page: 0,
        rule_option: '',
        keyword: '',
        previous_rule: '',
        priority: 0,
    }

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: defaultValues,
    });


    useEffect(() => {
        const initDB = async () => {
            db.current = await getDB();
        };
        initDB();
    }, []);

    useEffect(() => {
        const fetchRule = async () => {
            try {
                if (!db.current) {
                    db.current = await getDB();
                }
                if (ruleId) {
                    const rules = await getAllRuleNodes(db.current);
                    const ruleData = rules.find((rule) => rule.id === ruleId);

                    if (ruleData) {
                        const findKey = Object.keys(ruleData.rule.conditions[0])[0];
                        setCondition(findKey);

                        setRules(rules.filter((rule) => rule.id !== ruleId && !rule.parent?.toString().includes(ruleId)));
                        setRule(ruleData);
                        setValue(ruleData.parent?.toString() || '');

                        form.reset({
                            description: ruleData.rule.name,
                            page: ruleData.rule.actionValue,
                            rule_option: findKey,
                            keyword: ruleData.rule.conditions[0][findKey][1],
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
        let rule: RuleNode = new RuleNode(values.description, [{ [values.rule_option]: [{ "var": "query" }, values.keyword] }], values.page, values.priority);
        if (ruleId) {
            await updateRuleNode(db.current, ruleId, rule, values.previous_rule);
            console.log("Rule updated:", values);
            window.location.href = "/settings/rules";
        }
    };

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="w-2/3 space-y-6">
                <FormField
                    control={form.control}
                    name="previous_rule"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>From rule</FormLabel>
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
                            <FormLabel>Rule description</FormLabel>
                            <FormControl>
                                <Input placeholder="Rule description" {...field} />
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
                            <FormLabel>Condition</FormLabel><br />
                            <Popover open={conditionOpen} onOpenChange={setConditionOpen}>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        role="combobox"
                                        aria-expanded={conditionOpen}
                                        className="w-fit justify-between"
                                    >
                                        {condition
                                            ? allowedConditions.find((conditionName) => conditionName === condition)
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
                                                            setCondition(conditionName)
                                                            setConditionOpen(false)
                                                            field.onChange(conditionName)
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
                            <FormDescription>
                                You can only choose one rule.
                            </FormDescription>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                {form.watch("rule_option") === "find" ? <FormField
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
                            <FormLabel>Page</FormLabel>
                            <FormControl>
                                <Input type="number" {...field} />
                            </FormControl>
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
                                <Input type="number" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <Button type="submit">Update Rule</Button>
            </form>
        </Form>
    );
}
