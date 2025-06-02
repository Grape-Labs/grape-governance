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
      color="gray"
    >
      {(hasValidTitle && hasValidDescription) ? (
        description
      ) : (
        <>
          <Tooltip title={`Invalid or missing data`}>
            <h5 style={{ color: 'red' }}>
              <WarningIcon sx={{ fontSize: 16, color: 'red' }} /> <strong>WARNING!</strong> This proposal has missing data; carefully review the instructions before voting
              <small>
                <br/>Title: "{title}" Description: "{description}"
                <br />Proposal: {fallback}
              </small>
            </h5>
          </Tooltip>
        </>
      )}
    </Typography>
  );
};