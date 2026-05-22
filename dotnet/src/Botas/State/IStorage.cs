namespace Botas.State;

/// <summary>
/// Storage provider for reading/writing bot state.
/// Implementations must preserve unknown JSON properties during round-trip serialization.
/// </summary>
public interface IStorage
{
    /// <summary>
    /// Read items from storage.
    /// </summary>
    /// <param name="keys">Keys to read.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>Dictionary of key-value pairs that exist in storage. Missing keys are not included.</returns>
    Task<IDictionary<string, object>> ReadAsync(
        string[] keys,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Write items to storage.
    /// </summary>
    /// <param name="changes">Dictionary of key-value pairs to write.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    Task WriteAsync(
        IDictionary<string, object> changes,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Delete items from storage.
    /// </summary>
    /// <param name="keys">Keys to delete.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    Task DeleteAsync(
        string[] keys,
        CancellationToken cancellationToken = default);
}
