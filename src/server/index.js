const express = require('express');
const React = require('react');
const { renderToString } = require('react-dom/server');
const fs = require('fs');
const path = require('path');
const { Helmet } = require('react-helmet');
const App = require('../App').default;

const app = express();

app.use(express.static(path.resolve(__dirname, 'dist')));

app.get('*', (req, res) => {
    // Render the React app to a string
    const appString = renderToString(<App />);

    // Extract helmet data after rendering
    const helmet = Helmet.renderStatic();

    const indexFile = path.resolve(__dirname, 'dist/index.html');
    fs.readFile(indexFile, 'utf8', (err, data) => {
        if (err) {
            console.error('Error reading index.html', err);
            return res.status(500).send('Error loading page');
        }

        // Inject the app string and helmet tags into the HTML
        return res.send(
            data
              .replace('<div id="root"></div>', `<div id="root">${appString}</div>`)
              .replace('<title></title>', helmet.title.toString())
              .replace('<meta name="description" content="">', helmet.meta.toString())
        );
    });
});

app.listen(3000, () => {
    console.log('Server is running on http://localhost:3000');
});