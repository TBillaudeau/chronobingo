export default async function handler(req, res) {
    const { path } = req.query;

    if (!path) {
        return res.status(400).json({ error: 'Path is required' });
    }

    const DEEZER_API_BASE = 'https://api.deezer.com';

    // Construct the full URL. We need to preserve other query parameters.
    // req.query contains all params, so we remove 'path' and build the query string for the rest.
    const queryParams = { ...req.query };
    delete queryParams.path;

    const queryString = new URLSearchParams(queryParams).toString();
    const targetUrl = `${DEEZER_API_BASE}${path}${queryString ? `?${queryString}` : ''}`;

    try {
        const response = await fetch(targetUrl);

        if (!response.ok) {
            return res.status(response.status).json({ error: 'Deezer API error' });
        }

        const data = await response.json();
        res.status(200).json(data);
    } catch (error) {
        console.error('Deezer Proxy Error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
}
