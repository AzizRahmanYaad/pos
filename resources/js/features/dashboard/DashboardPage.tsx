import { Card, CardContent, Grid, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';

export function DashboardPage() {
    const { t } = useTranslation();

    return (
        <div>
            <Typography variant="h4" gutterBottom>
                {t('nav.dashboard')}
            </Typography>
            <Grid container spacing={2}>
                <Grid item xs={12} sm={6} md={3}>
                    <Card>
                        <CardContent>
                            <Typography color="text.secondary">{t('common.welcome')}</Typography>
                        </CardContent>
                    </Card>
                </Grid>
            </Grid>
        </div>
    );
}
