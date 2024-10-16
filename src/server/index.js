import { renderToString } from 'react-dom/server';
import fs from 'fs/promises'; // Use fs/promises for async/await support
import path from 'path';
import { Helmet } from 'react-helmet';
import App from '../App'; // Adjust path as necessary

const server = express();
const PORT = process.env.PORT || 3000;

server.use(express.static(path.resolve('dist'))); // Serve static files from the dist folder

server.get('*', async (req, res) => {
  try {
    // Render the App to a string
    const appString = renderToString(<App />);
    const helmet = Helmet.renderStatic();

    // Read the index.html file
    const indexHtml = await fs.readFile(path.resolve('dist/index.html'), 'utf8');
    // Replace placeholders with rendered app and helmet data
    const html = indexHtml
      .replace('<div id="root"></div>', `<div id="root">${appString}</div>`)
      .replace('<title></title>', helmet.title.toString())
      .replace('<meta name="description" content="">', helmet.meta.toString());

    // Send the response
    res.send(html);
  } catch (error) {
    console.error('Error loading page', error);
    res.status(500).send('Error loading page');
  }
});

// Start the server
server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});