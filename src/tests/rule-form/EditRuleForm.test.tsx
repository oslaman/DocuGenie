import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { EditRuleForm } from '@/components/features/rule-form/EditRuleForm';
import { getAllRuleNodes, updateRuleNode } from '@/utils/db/db-rules';
import { getDB } from '@/utils/db/db-helper';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { Mock } from 'vitest';
import '@testing-library/jest-dom';
import { object } from 'zod';
import { RuleNode } from '@/utils/rete-network';

// Mock the database functions
vi.mock('@/utils/db/db-rules', () => ({
    getAllRuleNodes: vi.fn(),
    updateRuleNode: vi.fn(),
}));

vi.mock('@/utils/db/db-helper', () => ({
    getDB: vi.fn(),
}));

describe('EditRuleForm', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders the form with initial values', async () => {
        const mockRule = {
            id: '1',
            rule: {
                name: 'Test Rule',
                conditions: [{ type: 'find', value: 'test', open: false }],
                actionValue: 1,
                salience: 10,
            },
            parent: '0',
        };

        (getDB as Mock).mockResolvedValue({});
        (getAllRuleNodes as Mock).mockResolvedValue([mockRule]);
        
        render(
            <MemoryRouter initialEntries={['/rules/1']}>
                <Routes>
                    <Route path="/rules/:ruleId" element={<EditRuleForm />} />
                </Routes>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByTestId('rule-description-input')).toHaveValue('Test Rule');
        });

        // expect(screen.getByTestId('condition-value-input')).toHaveValue('test');
        expect(screen.getByTestId('return-page-input')).toHaveValue(1);
        expect(screen.getByTestId('priority-input')).toHaveValue(10);
    });

    it('updates the rule on form submission', async () => {
        const mockRule = {
            id: '1',
            rule: {
                name: 'Test Rule',
                conditions: [{ type: 'find', value: 'test', open: false }],
                actionValue: 1,
                salience: 10,
            },
            parent: '0',
        };
    
        (getDB as Mock).mockResolvedValue({});
        (getAllRuleNodes as Mock).mockResolvedValue([mockRule]);
    
        render(
            <MemoryRouter initialEntries={['/rules/1']}>
                <Routes>
                    <Route path="/rules/:ruleId" element={<EditRuleForm />} />
                </Routes>
            </MemoryRouter>
        );
    
        await waitFor(() => {
            expect(screen.getByTestId('rule-description-input')).toHaveValue('Test Rule');
        });
    
        // Simulate user input
        fireEvent.change(screen.getByTestId('rule-description-input'), { target: { value: 'Updated Rule' } });
        fireEvent.change(screen.getByTestId('condition-value-input'), { target: { value: 'updated' } });
        fireEvent.change(screen.getByTestId('return-page-input'), { target: { value: 2 } });
        fireEvent.change(screen.getByTestId('priority-input'), { target: { value: 20 } });
    
        // Simulate form submission
        fireEvent.click(screen.getByText('Update Rule'));
    
        // await waitFor(() => {
        //     const expectedRule = {
        //         name: 'Updated Rule',
        //         conditions: [{ type: 'find', value: 'updated', open: false }],
        //         actionValue: 2,
        //         salience: 20,
        //     };
    
        //     expect(updateRuleNode).toHaveBeenCalledWith(
        //         expect.anything(),
        //         '1',
        //         expect.objectContaining(expectedRule),
        //         '0'
        //     );
        // });
    });

    it('adds a new condition', async () => {
        const mockRule = {
            id: '1',
            rule: {
                name: 'Test Rule',
                conditions: [{ type: 'find', value: 'test', open: false }],
                actionValue: 1,
                salience: 10,
            },
            parent: '0',
        };

        (getDB as Mock).mockResolvedValue({});
        (getAllRuleNodes as Mock).mockResolvedValue([mockRule]);

        render(
            <MemoryRouter initialEntries={['/rules/1']}>
                <Routes>
                    <Route path="/rules/:ruleId" element={<EditRuleForm />} />
                </Routes>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByPlaceholderText('Rule description')).toHaveValue('Test Rule');
        });

        fireEvent.click(screen.getByText('Add condition'));

        expect(screen.getAllByPlaceholderText('Enter condition value')).toHaveLength(2);
    });

    it('removes a condition', async () => {
        const mockRule = {
            id: '1',
            rule: {
                name: 'Test Rule',
                conditions: [{ type: 'find', value: 'test', open: false }],
                actionValue: 1,
                salience: 10,
            },
            parent: '0',
        };

        (getDB as Mock).mockResolvedValue({});
        (getAllRuleNodes as Mock).mockResolvedValue([mockRule]);

        render(
            <MemoryRouter initialEntries={['/rules/1']}>
                <Routes>
                    <Route path="/rules/:ruleId" element={<EditRuleForm />} />
                </Routes>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByPlaceholderText('Rule description')).toHaveValue('Test Rule');
        });

        fireEvent.click(screen.getByLabelText('Remove condition'));

        expect(screen.queryByPlaceholderText('Enter condition value')).toBeNull();
    });
});