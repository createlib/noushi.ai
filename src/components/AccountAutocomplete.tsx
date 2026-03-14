import React from 'react';
import { Autocomplete, TextField, createFilterOptions } from '@mui/material';
import type { Account } from '../db/db';

interface AccountAutocompleteProps {
    accounts: Account[];
    value: number | ''; // account code
    onChange: (newCode: number) => void;
    label?: string;
    disabled?: boolean;
    size?: 'small' | 'medium';
}

const filterOptions = createFilterOptions({
    matchFrom: 'any',
    stringify: (option: Account) => `${option.code} ${option.name}`, // 検索対象文字列（コードと名前両方でヒットさせる）
});

export const AccountAutocomplete: React.FC<AccountAutocompleteProps> = ({
    accounts,
    value,
    onChange,
    label = '科目',
    disabled = false,
    size = 'small'
}) => {
    // value から該当のアカウントオブジェクトを見つける
    const selectedAccount = accounts.find(a => a.code === value || a.id === value) || null;

    return (
        <Autocomplete
            options={accounts}
            getOptionLabel={(option) => `${option.code}: ${option.name}`}
            isOptionEqualToValue={(option, value) => option.code === value.code || option.id === value.id}
            value={selectedAccount}
            onChange={(_, newValue) => {
                if (newValue) {
                    onChange(newValue.code as number || newValue.id as number);
                }
            }}
            filterOptions={filterOptions}
            disabled={disabled}
            size={size}
            sx={{ flex: 1 }}
            renderInput={(params) => (
                <TextField
                    {...params}
                    label={label}
                    variant="outlined"
                />
            )}
        />
    );
};
