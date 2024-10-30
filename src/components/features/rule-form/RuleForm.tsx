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

interface RuleFormProps {
    currentRule: Rules;
    id?: string;
}

export function RuleForm() {
    const [open, setOpen] = useState(false)
    const [value, setValue] = useState("")
    const [conditionOpen, setConditionOpen] = useState(false)
    const [condition, setCondition] = useState("")
    const { rules, setRules } = useRulesContext();
    const [ruleConditions, setRuleConditions] = useState<{ type: string, value: string, open: boolean }[]>([]);
    const db = useRef<any>(null);

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

    const addRule = () => {
        setRuleConditions([...ruleConditions, { type: '', value: '', open: false }]);
    }

    const updateRule = (index: number, field: 'type' | 'value', value: string, open: boolean) => {
        const updatedRules = [...ruleConditions];
        updatedRules[index][field] = value;
        updatedRules[index].open = open;
        setRuleConditions(updatedRules);
    }

    const removeRule = (index: number) => {
        const updatedRules = ruleConditions.filter((_, i) => i !== index)
        setRuleConditions(updatedRules)
    }

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: defaultValues,
    });

    async function onSubmit(values: z.infer<typeof formSchema>) {
        console.log("Valori: ", values);
        let rule: RuleNode;
        let conditions: any[] = [];
        ruleConditions.forEach((ruleCondition) => {
            conditions.push({ [ruleCondition.type]: [{ "var": "query" }, ruleCondition.value] });
        });
        rule = new RuleNode(values.description, conditions, values.page, values.priority);
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
        console.table(allNodes);
    }

    useEffect(() => {
        const setup = async () => {
            db.current = await getDB();
        };
        setup();
    }, [db]);

    return (
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
                                        >
                                            {value
                                                ? rules.find((rule) => rule.id === field.value)?.rule.name
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
                                                                    updateRule(index, 'type', conditionName, ruleCondition.open)
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
                    name="page"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel data-testid="return-page-label">Return page</FormLabel>
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
                <Button type="submit">Add rule</Button>
            </form>
        </Form>
    );
}
