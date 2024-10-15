import express from 'express';
import path from 'path';
import React from 'react';
import ReactDOMServer from 'react-dom/server';
import App from '../App'; // Your main App component

const app = express();

// Serve static files from the dist directory
app.use(express.static(path.join(__dirname, 'dist')));

// Handle all requests
app.get('*', (req, res) => {
    const appString = ReactDOMServer.renderToString(<App />); // Render your app
    const indexFile = path.resolve('dist/index.html');

    // Read the HTML template
    fs.readFile(indexFile, 'utf8', (err, data) => {
        if (err) {
            console.log(err);
            return res.status(500).send('Error loading index.html');
        }

        // Replace the placeholder in the HTML with the rendered app
        return res.send(
            data.replace('<div id="root"></div>', `<div id="root">${appString}</div>`)
        );
    });
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
