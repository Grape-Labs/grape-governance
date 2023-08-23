import React from 'react';

function TestEmbed() {
    //src="https://spl-gov.vercel.app/embedproposal/By2sVGZXwfQq6rAiAM3rNPJ9iQfb5e2QhnF4YjJ4Bip/8yYqWqyDeLFNyLzwyoxvxPvnpYQ9GfSFtMz6aBnNp3eA" 
    
    return (
        <div>
            <iframe 
                src="https://spl-gov.vercel.app/embedgovernance/By2sVGZXwfQq6rAiAM3rNPJ9iQfb5e2QhnF4YjJ4Bip" 
                sandbox="allow-same-origin allow-top-navigation allow-scripts allow-forms allow-popup" 
                width="100%" 
                height="800" 
                loading="lazy" 
                frameBorder="0"
                title="Testing Embed Template"></iframe>
        </div>
  );
}

export default TestEmbed;