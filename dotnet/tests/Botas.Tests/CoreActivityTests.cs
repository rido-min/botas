using Botas.Schema;
using System.Text.Json;

namespace Botas.Tests
{
    public class CoreActivityTests
    {
        [Fact]
        public void Ctor_And_Nulls()
        {
            Activity a1 = new();
            Assert.NotNull(a1);
            Assert.Equal("message", a1.Type);
            Assert.Null(a1.Text);

            Activity a2 = new()
            {
                Type = "mytype"
            };
            Assert.NotNull(a2);
            Assert.Equal("mytype", a2.Type);
            Assert.Null(a2.Text);
        }

        [Fact]
        public void Json_Nulls_Not_Deserialized()
        {
            string json = """
            {
                "type": "message",
                "text": null
            }
            """;
            Activity act = Activity.FromJsonString(json);
            Assert.NotNull(act);
            Assert.Equal("message", act.Type);
            Assert.Null(act.Text);

            string json2 = """
            {
                "type": "message"
            }
            """;
            Activity act2 = Activity.FromJsonString(json2);
            Assert.NotNull(act2);
            Assert.Equal("message", act2.Type);
            Assert.Null(act2.Text);

        }

        [Fact]
        public void Accept_Unkown_Primitive_Fields()
        {
            string json = """
            {
                "type": "message",
                "text": "hello",
                "unknownString": "some string",
                "unknownInt": 123,
                "unknownBool": true,
                "unknownNull": null
            }
            """;
            Activity act = Activity.FromJsonString(json);
            Assert.NotNull(act);
            Assert.Equal("message", act.Type);
            Assert.Equal("hello", act.Text);
            Assert.True(act.Properties.ContainsKey("unknownString"));
            Assert.True(act.Properties.ContainsKey("unknownInt"));
            Assert.True(act.Properties.ContainsKey("unknownBool"));
            Assert.True(act.Properties.ContainsKey("unknownNull"));
            Assert.Equal("some string", act.Properties["unknownString"]?.ToString());
            Assert.Equal(123, ((JsonElement)act.Properties["unknownInt"]!).GetInt32());
            Assert.True(((JsonElement)act.Properties["unknownBool"]!).GetBoolean());
            Assert.Null(act.Properties["unknownNull"]);
        }

        [Fact]
        public void Serialize_Unkown_Primitive_Fields()
        {
            Activity act = new()
            {
                Type = "message",
                Text = "hello",
            };
            act.Properties["unknownString"] = "some string";
            act.Properties["unknownInt"] = 123;
            act.Properties["unknownBool"] = true;
            act.Properties["unknownNull"] = null;

            string json = act.ToJson();
            Assert.Contains("\"type\": \"message\"", json);
            Assert.Contains("\"text\": \"hello\"", json);
            Assert.Contains("\"unknownString\": \"some string\"", json);
            Assert.Contains("\"unknownInt\": 123", json);
            Assert.Contains("\"unknownBool\": true", json);
            Assert.Contains("\"unknownNull\": null", json);
        }

        [Fact]
        public void Deserialize_Unkown__Fields_In_KnownObjects()
        {
            string json = """
            {
                "type": "message",
                "text": "hello",
                "from": {
                    "id": "1",
                    "name": "tester",
                    "aadObjectId": "123"
                }
            }
            """;
            Activity act = Activity.FromJsonString(json);
            Assert.NotNull(act);
            Assert.Equal("message", act.Type);
            Assert.Equal("hello", act.Text);
            Assert.NotNull(act.From);
            Assert.IsType<ConversationAccount>(act.From);
            Assert.Equal("1", act.From!.Id);
            Assert.Equal("tester", act.From.Name);
            Assert.Equal("123", act.From.AadObjectId);
            Assert.False(act.From.Properties.ContainsKey("aadObjectId"));
        }

        [Fact]
        public void Deserialize_Serialize_Unkown__Fields_In_KnownObjects()
        {
            string json = """
            {
                "type": "message",
                "text": "hello",
                "from": {
                    "id": "1",
                    "name": "tester",
                    "aadObjectId": "123"
                }
            }
            """;
            Activity act = Activity.FromJsonString(json);
            act.Text = "updated";
            string json2 = act.ToJson();
            Assert.Contains("\"type\": \"message\"", json2);
            Assert.Contains("\"text\": \"updated\"", json2);
            Assert.Contains("\"from\": {", json2);
            Assert.Contains("\"id\": \"1\"", json2);
            Assert.Contains("\"name\": \"tester\"", json2);
            Assert.Contains("\"aadObjectId\": \"123\"", json2);
        }

        [Fact]
        public void Handling_Nulls_from_custom_serializer()
        {
            string json = """
            {
                "type": "message",
                "text": null,
                "unknownString": null
            }
            """;
            Activity? act = JsonSerializer.Deserialize<Activity>(json); //without default options
            Assert.NotNull(act);
            Assert.Equal("message", act.Type);
            Assert.Null(act.Text);
            Assert.Null(act.Properties["unknownString"]!);

            string json2 = JsonSerializer.Serialize(act); //without default options
            Assert.Contains("\"type\":\"message\"", json2);
            Assert.Contains("\"text\":null", json2);
            Assert.Contains("\"unknownString\":null", json2);
        }

        [Fact]
        public void CreateReply()
        {
            Activity act = new()
            {
                Text = "hello",
                Id = "activity1",
                ChannelId = "channel1",
                ServiceUrl = "http://service.url",
                From = new ConversationAccount()
                {
                    Id = "user1",
                    Name = "User One"
                },
                Recipient = new ConversationAccount()
                {
                    Id = "bot1",
                    Name = "Bot One"
                },
                Conversation = new Conversation()
                {
                    Id = "conversation1"
                }
            };
            Activity reply = act.CreateReplyActivity("reply");
            Assert.NotNull(reply);
            Assert.Equal("message", reply.Type);
            Assert.Equal("reply", reply.Text);
            Assert.Equal("channel1", reply.ChannelId);
            Assert.Equal("http://service.url", reply.ServiceUrl);
            Assert.Equal("conversation1", reply.Conversation?.Id);
            Assert.Equal("bot1", reply.From?.Id);
            Assert.Equal("Bot One", reply.From?.Name);
            Assert.Equal("user1", reply.Recipient?.Id);
            Assert.Equal("User One", reply.Recipient?.Name);
            Assert.Equal("activity1", reply.ReplyToId);
        }
    }
}
