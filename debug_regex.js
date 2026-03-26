const NAME_PATTERNS = [
  /(?:my name is|call me|this is) ([A-Z][a-z]+)/i,
  /([A-Z][a-z]+) here/i,
  /(?:[Ii]'m|[Ii] am) ([A-Z][A-Za-z]+)/
];

const input = "Hi, I'm Alex. I've been feeling stressed at work.";

for (const pattern of NAME_PATTERNS) {
    const match = input.match(pattern);
    console.log(`Pattern: ${pattern}, Match:`, match);
}
