using Botas.State;
using Xunit;

namespace Botas.Tests;

/// <summary>
/// Cross-language parity tests for FileStorage filename encoding.
/// These tests validate that the filename encoding matches the canonical spec (RFC 3986 percent-encoding).
/// </summary>
public class StateFilenameParityTests
{
    [Theory]
    [InlineData("foo/bar", "foo%2Fbar.json")]
    [InlineData("foo bar", "foo%20bar.json")]
    [InlineData("user@domain.com", "user%40domain.com.json")]
    [InlineData("key:with:colons", "key%3Awith%3Acolons.json")]
    [InlineData("simple-key_123", "simple-key_123.json")]
    [InlineData("channels/msteams/conversations/conv-1/users/user-abc", "channels%2Fmsteams%2Fconversations%2Fconv-1%2Fusers%2Fuser-abc.json")]
    [InlineData("msteams/bot-123/conversations/conv-456", "msteams%2Fbot-123%2Fconversations%2Fconv-456.json")]
    [InlineData("key+with+plus", "key%2Bwith%2Bplus.json")]
    [InlineData("key%with%percent", "key%25with%25percent.json")]
    [InlineData("key&with&ampersand", "key%26with%26ampersand.json")]
    [InlineData("key=with=equals", "key%3Dwith%3Dequals.json")]
    [InlineData("héllo", "h%C3%A9llo.json")]
    public void FileStorage_KeyEncoding_MatchesCanonicalSpec(string key, string expectedFilename)
    {
        // Use Uri.EscapeDataString as per spec
        var encoded = Uri.EscapeDataString(key) + ".json";
        Assert.Equal(expectedFilename, encoded);
    }

    [Fact]
    public async Task FileStorage_CrossLanguageInterop_SameKey()
    {
        var testDirectory = Path.Combine(Path.GetTempPath(), $"botas-parity-{Guid.NewGuid()}");
        try
        {
            var storage = new FileStorage(testDirectory);
            var testKey = "channels/msteams/conversations/conv-1/users/user-abc";
            var testValue = new Dictionary<string, object?> { ["testData"] = "cross-language-test" };

            // Write
            await storage.WriteAsync(new Dictionary<string, object> { [testKey] = testValue });

            // Verify the filename matches canonical encoding
            var expectedFilename = "channels%2Fmsteams%2Fconversations%2Fconv-1%2Fusers%2Fuser-abc.json";
            var expectedPath = Path.Combine(testDirectory, expectedFilename);
            Assert.True(File.Exists(expectedPath), $"Expected file at {expectedPath}");

            // Read back
            var result = await storage.ReadAsync([testKey]);
            Assert.True(result.ContainsKey(testKey));
        }
        finally
        {
            if (Directory.Exists(testDirectory))
            {
                Directory.Delete(testDirectory, recursive: true);
            }
        }
    }
}
