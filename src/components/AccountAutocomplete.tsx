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
    filterPrivate?: boolean;
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
    size = 'small',
    filterPrivate
}) => {
    // 勘定科目のフィルタリング（プライベート用コードは9800〜9989とする）
    const filteredAccounts = React.useMemo(() => {
        if (filterPrivate === undefined) return accounts;
        return accounts.filter(a => {
            const codeNum = typeof a.code === 'number' ? a.code : parseInt(a.code as any, 10);
            if (isNaN(codeNum)) return true; // コードがない場合はとりあえず残す
            if (filterPrivate) {
                return (codeNum >= 9800 && codeNum <= 9989) || codeNum === 100 || codeNum === 111;
            } else {
                return codeNum < 9800 || codeNum > 9989;
            }
        });
    }, [accounts, filterPrivate]);

    // value から該当のアカウントオブジェクトを見つける（フィルタ外のものでも選択状態は維持できるように全体から探す）
    const selectedAccount = accounts.find(a => a.code === value || a.id === value) || null;

    return (
        <Autocomplete
            options={filteredAccounts}
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
