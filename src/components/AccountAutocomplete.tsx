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

const filterOptions = createFilterOptions<Account>({
    matchFrom: 'any',
    stringify: (option) => option ? `${option.code || option.id} ${option.name || ''}` : '',
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
            getOptionLabel={(option) => option ? `${option.code || option.id}: ${option.name || ''}` : ''}
            isOptionEqualToValue={(option, val) => {
                if (!option || !val) return option === val;
                return option.code === val.code || option.id === val.id;
            }}
            value={selectedAccount}
            onChange={(_, newValue) => {
                if (newValue) {
                    onChange((newValue.code || newValue.id) as number);
                } else {
                    onChange('' as any); // Clear behavior
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
