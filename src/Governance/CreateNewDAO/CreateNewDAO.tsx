// pages/dao/create/index.tsx or a similar route
import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Card,
  CardActionArea,
  CardContent,
  Grid,
} from '@mui/material';

const DAO_TYPES = [
  {
    route: '/dao/create/multisig',
    name: 'Multi-Sig DAO',
    description:
      'A shared wallet controlled by multiple members. Perfect for teams or trusted groups requiring multi-party approvals.',
  },
  {
    route: '/dao/create/community',
    name: 'Community Token DAO',
    description:
      'A community-driven DAO where membership and voting power are defined by holding a governance token.',
  },
];

export default function CreateNewDAO() {
  const navigate = useNavigate();

  return (
    <Box sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h4" gutterBottom>
        Choose DAO Type
      </Typography>
      <Typography variant="subtitle1" color="textSecondary" sx={{ mb: 4 }}>
        Start by choosing how your DAO will be structured
      </Typography>

      <Grid container spacing={4}>
        {DAO_TYPES.map(({ route, name, description }) => (
          <Grid item xs={12} sm={6} md={4} key={name}>
            <Card elevation={3}>
              <CardActionArea onClick={() => navigate(route)}>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    {name}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    {description}
                  </Typography>
                </CardContent>
              </CardActionArea>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}