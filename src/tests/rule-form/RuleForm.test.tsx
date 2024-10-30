import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import '@testing-library/jest-dom';
import { RuleForm } from '@/components/features/rule-form/RuleForm';
import { RulesContext } from '@/context/context';
import { Rules } from '@/utils/interfaces';

describe('RuleForm Component', () => {
    it('renders the form with initial values', () => {
        const rules: Rules[] = [];
        const setRules = vi.fn();

        render(
            <RulesContext.Provider value={{ rules, setRules }}>
                <RuleForm />
            </RulesContext.Provider>
        );

        expect(screen.getByTestId('from-rule-label')).toBeInTheDocument();
        expect(screen.getByTestId('rule-description-label')).toBeInTheDocument();
        expect(screen.getByTestId('condition-label')).toBeInTheDocument();
        expect(screen.getByTestId('return-page-label')).toBeInTheDocument();
        expect(screen.getByTestId('priority-label')).toBeInTheDocument();
    });

    it('allows adding and removing conditions', () => {
        const rules: Rules[] = [];
        const setRules = vi.fn();

        render(
            <RulesContext.Provider value={{ rules, setRules }}>
                <RuleForm />
            </RulesContext.Provider>
        );

        const addConditionButton = screen.getByText(/Add condition/i);
        fireEvent.click(addConditionButton);

        expect(screen.getAllByPlaceholderText(/Enter rule value/i)).toHaveLength(1);

        const removeConditionButton = screen.getByLabelText(/Remove condition/i);
        fireEvent.click(removeConditionButton);

        expect(screen.queryByPlaceholderText(/Enter rule value/i)).not.toBeInTheDocument();
    });

    it('submits the form with correct values', async () => {
        const rules: Rules[] = [];
        const setRules = vi.fn();

        render(
            <RulesContext.Provider value={{ rules, setRules }}>
                <RuleForm />
            </RulesContext.Provider>
        );

        fireEvent.change(screen.getByLabelText(/Rule description/i), { target: { value: 'Test Rule' } });
        fireEvent.change(screen.getByLabelText(/Return page/i), { target: { value: '1' } });
        fireEvent.change(screen.getByLabelText(/Priority/i), { target: { value: '5' } });

        const submitButton = screen.getByText(/Add rule/i);
        fireEvent.click(submitButton);

        // TODO: Add assertions to check if the form submission logic is triggered correctly
    });
});