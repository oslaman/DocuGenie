import { useEffect, useRef } from "react";
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
const formSchema = z.object({
    description: z.string().min(2),
    rule_option: z
        .string({
            required_error: "Please select an rule to use.",
        }),
    page: z.string(),
    keyword: z.string(),
    previous_rule: z.string(),
    priority: z.string(),
});

export function RuleForm() {
    const { rules, setRules } = useRulesContext();
    const db = useRef<any>(null);

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            description: '',
            page: '',
            keyword: '',
            previous_rule: '',
            priority: '',
        },
    });

    async function onSubmit(values: z.infer<typeof formSchema>) {
        console.log("Valori: ", values);
        let rule: RuleNode;
        if (values.previous_rule === '') {
            switch (values.rule_option) {
                case "keyword":
                    console.log('Keyword: ', values.keyword);
                    rule = new RuleNode(values.description, [(facts: Record<string, any>) => facts['content'].includes(values.keyword)], (facts) => { facts['pages'].push(values.page); }, 0);
                    insertRootRuleNode(db.current, rule);
                    const allNodes = await getAllRuleNodes(db.current);
                    rules.splice(0, rules.length);
                    allNodes.forEach((node) => {
                        setRules([...rules, { id: node.id, rule: node.rule }]);
                    });
                    console.table(allNodes);
                    break;
            }
        } else {
            rule = new RuleNode(values.description, [(facts: Record<string, any>) => facts['content'].includes(values.keyword)], (facts) => { facts['pages'].push(values.page); }, 0);
            insertChildRuleNode(db.current, rule, values.previous_rule);
            const allNodes = await getAllRuleNodes(db.current);
            rules.splice(0, rules.length);
            allNodes.forEach((node) => {
                setRules([...rules, { id: node.id, rule: node.rule }]);
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
                <form onSubmit={form.handleSubmit(onSubmit)}>
                    <FormField
                        control={form.control}
                        name="previous_rule"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>From rule</FormLabel>
                                <Select disabled={rules.length === 0} onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select a previous rule" />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        {
                                            rules.map((rule, index) => {
                                                console.log("Rules in form", rule);
                                                return (
                                                    <SelectItem key={index} value={rule.id}>
                                                        {rule.rule.name || "Unnamed Rule"}
                                                    </SelectItem>
                                                );
                                            })
                                        }
                                    </SelectContent>
                                </Select>
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
                                <FormLabel>Return page</FormLabel>
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