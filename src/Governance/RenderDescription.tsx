import React from 'react';
import { Typography, Tooltip } from '@mui/material';
import WarningIcon from '@mui/icons-material/Warning';

export const isValidDescription = (desc?: string): boolean => {
  if (!desc) return false;

  const trimmed = desc.trim();
  if (trimmed.length < 10 || !/[a-zA-Z0-9]/.test(trimmed)) return false;

  const nonPunct = trimmed.replace(/[^\w\s]/g, '').trim();
  if (nonPunct.length < 5) return false;

  const wordCount = nonPunct.split(/\s+/).filter(Boolean).length;
  return wordCount >= 2;
};

export const isValidTitle = (title?: string): boolean => {
  return !!title && title.trim().length >= 2 && /[a-zA-Z0-9]/.test(title);
};

type RenderDescriptionProps = {
  title?: string;
  description?: string;
  fallback: string;
};

export const RenderDescription: React.FC<RenderDescriptionProps> = ({ title, description, fallback }) => {
  const hasValidTitle = isValidTitle(title);
  const hasValidDescription = isValidDescription(description);

  return (
    <Typography
      variant="body1"
      color="gray"
      sx={{ display: 'flex', alignItems: 'center' }}
    >
      {hasValidTitle ? (
        title
      ) : hasValidDescription ? (
        description
      ) : (
        <>
          <Tooltip title="Invalid or missing description">
            <h4 style={{ color: 'red' }}>
              <WarningIcon sx={{ fontSize: 16, color: 'red' }} /> WARNING! Proposal seems to have an invalid or missing
              description, carefully review the instructions
              <br />
              Proposal {fallback}
            </h4>
          </Tooltip>
        </>
      )}
    </Typography>
  );
};