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
import { getDB, getAllRuleNodes, insertRootRuleNode, insertChildRuleNode, updateRuleNode, removeRuleNode } from "@/utils/db";
import { RuleNode } from "@/utils/rete-network";
import { useRulesContext } from "@/components/context";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from "@/components/ui/command";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { LogicEngine } from "json-logic-engine";
import { Rules } from "@/pages/rules/rules-form";
import { useParams } from "react-router-dom";

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
    rule: Rules;
}

export function RuleForm({ rule }: RuleFormProps) {
    const [open, setOpen] = useState(false)
    const [value, setValue] = useState("")
    const [conditionOpen, setConditionOpen] = useState(false)
    const [condition, setCondition] = useState("")
    const { rules, setRules } = useRulesContext();
    const { ruleId } = useParams();
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

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: defaultValues,
    });

    useEffect(() => {
        if (ruleId) {
            console.log("Rule id: ", ruleId);
            const rule = rules.find((rule) => rule.id === ruleId);
            console.log("Rule: ", rule);
            if (rule) {
                defaultValues = {
                    description: rule.rule.name,
                    page: rule.rule.actionValue,
                    rule_option: rule.rule.conditions[0],
                    keyword: rule.rule.conditions[0]["var"],
                    previous_rule: rule.parent,
                    priority: rule.rule.salience,
                };
                form.reset(defaultValues);
            } else {
                console.warn("No rule found with the given ruleId:", ruleId);
            }
        }
    }, [rule]);

    async function onUpdate(values: z.infer<typeof formSchema>) {
        console.log("Valori: ", values);
        if (ruleId) {
            updateRuleNode(db.current, ruleId, values);
        }
    }

    async function onDelete(ruleId: string) {
        console.log("Rule id: ", ruleId);
        if (ruleId) {
            removeRuleNode(db.current, ruleId);
        }
    }

    async function onSubmit(values: z.infer<typeof formSchema>) {
        console.log("Valori: ", values);
        let rule: RuleNode;
        rule = new RuleNode(values.description, [{ [values.rule_option]: [{ "var": "query" }, values.keyword] }], values.page, values.priority);
        if (values.previous_rule === '') {
            insertRootRuleNode(db.current, rule);
            const allNodes = await getAllRuleNodes(db.current);
            allNodes.forEach((node) => {
                setRules([...rules, { id: node.id, rule: node.rule, parent: node.parent }]);
            });
            console.table(allNodes);
        } else {
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
                    {ruleId ? <Button type="button" onClick={() => onUpdate(form.getValues())}>Update rule</Button> : null}
                    {ruleId ? <Button type="button" onClick={() => onDelete(ruleId)}>Delete rule</Button> : null}
                </form>
            </Form>
        </div>
    );
}
