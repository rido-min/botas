using System.Text.Json.Nodes;

namespace Botas;

/// <summary>
/// Fluent builder for constructing outbound <see cref="CoreActivity"/> instances.
/// </summary>
public class CoreActivityBuilder
{
    private string _type = "message";
    private string? _serviceUrl;
    private Conversation? _conversation;
    private ChannelAccount? _from;
    private ChannelAccount? _recipient;
    private string _text = "";
    private JsonArray? _entities;
    private JsonArray? _attachments;

    /// <summary>
    /// Copy routing fields from an incoming activity and swap from/recipient.
    /// </summary>
    public CoreActivityBuilder WithConversationReference(CoreActivity source)
    {
        _serviceUrl = source.ServiceUrl;
        _conversation = source.Conversation;
        _from = source.Recipient;
        _recipient = source.From;
        return this;
    }

    /// <summary>
    /// Set the activity type (default is <c>"message"</c>).
    /// </summary>
    public CoreActivityBuilder WithType(string type)
    {
        _type = type;
        return this;
    }

    /// <summary>
    /// Set the service URL for the channel.
    /// </summary>
    public CoreActivityBuilder WithServiceUrl(string serviceUrl)
    {
        _serviceUrl = serviceUrl;
        return this;
    }

    /// <summary>
    /// Set the conversation reference.
    /// </summary>
    public CoreActivityBuilder WithConversation(Conversation conversation)
    {
        _conversation = conversation;
        return this;
    }

    /// <summary>
    /// Set the sender account.
    /// </summary>
    public CoreActivityBuilder WithFrom(ChannelAccount from)
    {
        _from = from;
        return this;
    }

    /// <summary>
    /// Set the recipient account.
    /// </summary>
    public CoreActivityBuilder WithRecipient(ChannelAccount recipient)
    {
        _recipient = recipient;
        return this;
    }

    /// <summary>
    /// Set the text content of the activity.
    /// </summary>
    public CoreActivityBuilder WithText(string text)
    {
        _text = text;
        return this;
    }

    /// <summary>
    /// Set the entities array.
    /// </summary>
    public CoreActivityBuilder WithEntities(JsonArray entities)
    {
        _entities = entities;
        return this;
    }

    /// <summary>
    /// Set the attachments array.
    /// </summary>
    public CoreActivityBuilder WithAttachments(JsonArray attachments)
    {
        _attachments = attachments;
        return this;
    }

    /// <summary>
    /// Build a new <see cref="CoreActivity"/> from the current builder state.
    /// </summary>
    public CoreActivity Build()
    {
        return new()
        {
            Type = _type,
            ServiceUrl = _serviceUrl,
            Conversation = _conversation,
            From = _from,
            Recipient = _recipient,
            Text = _text,
            Entities = _entities,
            Attachments = _attachments
        };
    }
}
