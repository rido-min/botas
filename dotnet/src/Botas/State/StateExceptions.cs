namespace Botas.State;

/// <summary>
/// Exception thrown when state fails to load from storage at turn start.
/// Turn processing is aborted and returns HTTP 500.
/// </summary>
public class StateLoadException : Exception
{
    /// <summary>
    /// Initializes a new instance of StateLoadException.
    /// </summary>
    /// <param name="message">Error message.</param>
    /// <param name="innerException">Original exception that caused the load failure.</param>
    public StateLoadException(string message, Exception innerException)
        : base(message, innerException)
    {
    }
}

/// <summary>
/// Exception thrown when state fails to save to storage at turn end.
/// The turn has already completed successfully, but state changes could not be persisted.
/// </summary>
public class StateSaveException : Exception
{
    /// <summary>
    /// Initializes a new instance of StateSaveException.
    /// </summary>
    /// <param name="message">Error message.</param>
    /// <param name="innerException">Original exception that caused the save failure.</param>
    public StateSaveException(string message, Exception innerException)
        : base(message, innerException)
    {
    }
}
