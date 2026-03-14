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
            ListboxProps={{
                sx: {
                    fontSize: { xs: '0.75rem', sm: '0.875rem' },
                    '& .MuiAutocomplete-option': {
                        minHeight: { xs: '32px', sm: '48px' },
                        padding: { xs: '4px 8px', sm: '6px 16px' }
                    }
                }
            }}
            renderInput={(params) => (
                <TextField
                    {...params}
                    label={label}
                    variant="outlined"
                    InputProps={{
                        ...params.InputProps,
                        sx: { fontSize: { xs: '0.75rem', sm: '0.875rem' }, padding: { xs: '2px', sm: '8.5px 14px' } }
                    }}
                    InputLabelProps={{
                        sx: { fontSize: { xs: '0.75rem', sm: '0.875rem' } }
                    }}
                />
            )}
        />
    );
};
