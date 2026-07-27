import type { ElementType, ReactNode } from 'react';
import { IconButton, Tooltip } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';

interface AddButtonProps {
    /** What this creates — "New customer", "New expense". Never shown as
     *  text, but it is the tooltip and the accessible name, so it must read
     *  as a sentence rather than as a word like "Add". */
    label: string;
    onClick?: () => void;
    disabled?: boolean;
    /** For the few that navigate to a page rather than opening a dialog. */
    component?: ElementType;
    to?: string;
    icon?: ReactNode;
}

/**
 * The single control for "create one of these", used on every list screen.
 *
 * It is deliberately small and wordless: on a page whose job is to show
 * data, the button to add a row should sit quietly in the corner rather
 * than compete with the table for attention.
 *
 * Dropping the label is only acceptable because the meaning is carried
 * elsewhere — a tooltip on hover, and an accessible name for screen
 * readers and keyboard users, both from the same `label`. An icon-only
 * button without those is a button nobody can identify.
 */
export function AddButton({ label, onClick, disabled = false, component, to, icon }: AddButtonProps) {
    return (
        <Tooltip title={label}>
            {/* A disabled button fires no events, so the tooltip needs a
                wrapper that still can — otherwise the one explanation of
                what the button does disappears exactly when it is needed. */}
            <span>
                <IconButton
                    aria-label={label}
                    onClick={onClick}
                    disabled={disabled}
                    component={component ?? 'button'}
                    {...(to ? { to } : {})}
                    size="small"
                    sx={{
                        width: 32,
                        height: 32,
                        flexShrink: 0,
                        borderRadius: 1.5,
                        bgcolor: 'primary.main',
                        color: 'primary.contrastText',
                        '&:hover': { bgcolor: 'primary.dark' },
                        '&.Mui-disabled': { bgcolor: 'action.disabledBackground', color: 'action.disabled' },
                    }}
                >
                    {icon ?? <AddIcon sx={{ fontSize: 18 }} />}
                </IconButton>
            </span>
        </Tooltip>
    );
}
