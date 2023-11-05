import React, { useState } from 'react';
import { Client } from 'twitter-api-sdk';

const TwitterVerification = () => {
  const [username, setUsername] = useState('');
  const [isVerified, setIsVerified] = useState(false);
  const [error, setError] = useState(null);

  const handleVerify = async () => {
    try {
      const client = new Client({
        clientId: 'YOUR_CLIENT_ID',
        clientSecret: 'ls1y6MpIbrBes7zknbRbqLB9LvMddbvgorXDmrD3oQNDmGe75M',
        accessToken: '1437416488571449352-AqbZNYBnjplcIabJSqAYH4gR1vsNgB',
        accessTokenSecret: 'fNJZh8QJjkAVkRm1YoeRja9RNak3BaQKxyZjqSQL62lmn',
      });

      const user = await client.get(`users/show/${username}`);
      setIsVerified(user.verified);
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div>
      <h1>Twitter Account Verification</h1>

      <input
        type="text"
        placeholder="Enter Twitter username"
        value={username}
        onChange={(event) => setUsername(event.target.value)}
      />

      <button onClick={handleVerify}>Verify Account</button>

      {isVerified ? (
        <p>The Twitter account @{username} is verified.</p>
      ) : (
        <p>The Twitter account @{username} is not verified.</p>
      )}

      {error && <p className="error">Error: {error}</p>}
    </div>
  );
};

export default TwitterVerification;