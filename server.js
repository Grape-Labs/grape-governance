const express = require('express');
const React = require('react');
const { renderToString } = require('react-dom/server');
const fs = require('fs');
const path = require('path');
const App = require('./src/App').default;

const app = express();

app.use(express.static(path.resolve(__dirname, 'dist')));

app.get('*', (req, res) => {
    const app = renderToString(<App />);

    const indexFile = path.resolve(__dirname, 'dist/index.html');
    fs.readFile(indexFile, 'utf8', (err, data) => {
        if (err) {
            console.error('Error reading index.html', err);
            return res.status(500).send('Error loading page');
        }

        return res.send(
            data.replace('<div id="root"></div>', `<div id="root">${app}</div>`)
        );
    });
});

app.listen(3000, () => {
    console.log('Server is running on http://localhost:3000');
});