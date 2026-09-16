// ----------------------------------------------------------------------

export function cssBaseline(theme) {
  return {
    MuiCssBaseline: {
      styleOverrides: {
        '*': {
          boxSizing: 'border-box',
        },
        html: {
          margin: 0,
          padding: 0,
          width: '100%',
          height: '100%',
          WebkitOverflowScrolling: 'touch',
        },
        body: {
          margin: 0,
          padding: 0,
          width: '100%',
          height: '100%',
        },
        '#root, #__next': {
          width: '100%',
          height: '100%',
        },
        // Native Windows menus may otherwise combine a white popup with light text.
        select: {
          colorScheme: theme.palette.mode,
        },
        'select option, select optgroup': {
          color: theme.palette.text.primary,
          backgroundColor: theme.palette.background.paper,
        },
        'select option:disabled, select optgroup:disabled': {
          color: theme.palette.text.disabled,
        },
        '@media (forced-colors: active)': {
          'select option, select optgroup': {
            color: 'CanvasText',
            backgroundColor: 'Canvas',
          },
          'select option:disabled, select optgroup:disabled': {
            color: 'GrayText',
          },
        },
        input: {
          '&[type=number]': {
            MozAppearance: 'textfield',
            '&::-webkit-outer-spin-button': {
              margin: 0,
              WebkitAppearance: 'none',
            },
            '&::-webkit-inner-spin-button': {
              margin: 0,
              WebkitAppearance: 'none',
            },
          },
        },
        img: {
          maxWidth: '100%',
          display: 'inline-block',
          verticalAlign: 'bottom',
        },
      },
    },
  };
}
