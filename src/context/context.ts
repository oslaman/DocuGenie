import { createContext, useContext } from "react";
import { Rules } from "@/utils/interfaces";

export const RulesContext = createContext<{
    rules: Rules[] | undefined,
    setRules: (rules: Rules[]) => void
}>({
    rules: undefined,
    setRules: () => {}
});

export function useRulesContext(){
    const {rules, setRules} = useContext(RulesContext);
    if(rules === undefined){
        throw new Error("useRulesContext must be used within a RulesContext.Provider");
    }
    return {rules, setRules};
}
